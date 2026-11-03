import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac, randomUUID } from "node:crypto";
import request from "supertest";
import { ServerClient } from "postmark";
import { createApp } from "./app.js";
import { db } from "./db.js";
import { processCommerce } from "./commerce.js";
import {
  isMember,
  membershipExpiry,
  releaseDue,
  validSignature,
  REVIEW_MS,
} from "./payment-rules.js";

test("membership boundaries, review deadlines and raw webhook signatures", () => {
  const now = new Date("2026-11-03T12:00:00Z");
  assert.equal(isMember(now, now), false);
  assert.equal(isMember(new Date(now.getTime() + 1), now), true);
  assert.equal(releaseDue("disputed", now, now), false);
  assert.equal(releaseDue("delivered", now, now), true);
  assert.equal(releaseDue("delivered", new Date(now.getTime() + 1), now), false);
  assert.equal(membershipExpiry(null, now).getTime(), now.getTime() + 30 * 86400000);
  assert.equal(
    membershipExpiry(new Date(now.getTime() + 86400000), now).getTime(),
    now.getTime() + 31 * 86400000,
  );
  const body = Buffer.from('{"event":"charge.success"}');
  const signature = createHmac("sha512", "secret").update(body).digest("hex");
  assert.ok(validSignature(body, signature, "secret"));
  assert.equal(validSignature(Buffer.from("{}"), signature, "secret"), false);
  assert.equal(validSignature(body, "invalid", "secret"), false);
});

test("marketplace integration: verified membership, reservations, dispute freeze, payout and refund", async (t) => {
  const original = { ...process.env };
  process.env["PAYSTACK_SECRET_KEY"] = "sk_test_doinggood_mock_only";
  process.env["PAYMENTS_ENABLED"] = "true";
  process.env["PAYSTACK_HOLDING_APPROVED"] = "true";
  const marker = `commerce-test-${randomUUID()}`;
  const userIds: string[] = [];
  const itemIds: string[] = [];
  const verified = new Map<string, { email: string; amount: number }>();
  const transfers = new Map<string, { amount: number; recipient: string }>();
  let transferCalls = 0;
  let refundCalls = 0;
  let emailFails = false;
  let invalidTransfer = false;
  t.mock.method(ServerClient.prototype, "sendEmail", async () => {
    if (emailFails) throw new Error("Mail outage");
    return { ErrorCode: 0, Message: "OK", MessageID: "mock" };
  });
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    assert.equal(
      url.origin,
      "https://api.paystack.co",
      "Tests must never call a live payment service",
    );
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    const path = url.pathname;
    let data: unknown;
    if (path === "/transaction/initialize")
      data = { authorization_url: `https://checkout.paystack.com/mock-${body.reference}` };
    else if (path.startsWith("/transaction/verify/")) {
      const reference = path.split("/").at(-1)!;
      const payment = verified.get(reference);
      data = {
        status: payment ? "success" : "pending",
        reference,
        amount: payment?.amount,
        currency: "NGN",
        customer: { email: payment?.email },
        paid_at: new Date().toISOString(),
      };
    } else if (path.startsWith("/transfer/verify/")) {
      const reference = path.split("/").at(-1)!;
      const transfer = transfers.get(reference);
      if (!transfer) return new Response(JSON.stringify({ status: false }), { status: 404 });
      data = {
        status: "success",
        reference,
        amount: transfer.amount + (invalidTransfer ? 1 : 0),
        currency: "NGN",
        recipient: { recipient_code: transfer.recipient },
        transfer_code: "TRF_mock",
      };
    } else if (path === "/transfer") {
      transferCalls++;
      assert.equal(transfers.has(body.reference), false, "Never initiate the same transfer twice");
      transfers.set(body.reference, { amount: body.amount, recipient: body.recipient });
      data = { status: "pending", transfer_code: "TRF_mock" };
    } else if (path === "/refund") {
      refundCalls++;
      data = { id: 12345 };
    } else if (path === "/refund/12345")
      data = { status: "processed", amount: 500000, currency: "NGN" };
    else throw new Error(`Unexpected payment call ${path}`);
    return new Response(JSON.stringify({ status: true, data }), { status: 200 });
  });
  const app = createApp();
  async function identity(name: string) {
    const user = await db.user.create({
      data: {
        email: `${marker}-${name}@example.com`,
        full_name: name,
        phone: "+2348012345678",
        ...(name === "seller" ? { payout_recipient: "RCP_mock" } : {}),
      },
    });
    userIds.push(user.id);
    const token = randomUUID();
    await db.session.create({
      data: {
        id: createHash("sha256").update(token).digest("hex"),
        user_id: user.id,
        expires_at: new Date(Date.now() + 3600000),
      },
    });
    return { ...user, cookie: `doinggood_session=${token}` };
  }
  async function item(owner_id: string, price_kobo: number) {
    const listing = await db.item.create({
      data: {
        owner_id,
        title: marker,
        description: "Integration test item",
        category: "other",
        condition: "good",
        location: "Lagos",
        photos: [],
        price_kobo,
      },
    });
    itemIds.push(listing.id);
    return listing;
  }
  try {
    const seller = await identity("seller");
    const buyer = await identity("buyer");
    const stranger = await identity("stranger");
    const admin = await identity("admin");
    process.env["COMMERCE_ADMIN_EMAILS"] = admin.email;
    const free = await item(seller.id, 0);
    assert.equal(
      (await request(app).get(`/api/items/${free.id}`).set("Cookie", buyer.cookie)).body
        .donor_whatsapp,
      "",
    );
    process.env["PAYMENTS_ENABLED"] = "false";
    assert.equal(
      (await request(app).post("/api/membership/checkout").set("Cookie", buyer.cookie).send({}))
        .status,
      503,
    );
    assert.equal(
      (await request(app).get(`/api/items/${free.id}`).set("Cookie", buyer.cookie)).body
        .donor_whatsapp,
      seller.phone,
    );
    process.env["PAYMENTS_ENABLED"] = "true";
    const memberCheckout = await request(app)
      .post("/api/membership/checkout")
      .set("Cookie", buyer.cookie)
      .send({});
    assert.equal(memberCheckout.status, 200);
    const memberRef = memberCheckout.body.reference as string;
    const verify = (reference: string, cookie = buyer.cookie) =>
      request(app).post("/api/payments/verify").set("Cookie", cookie).send({ reference });
    assert.equal((await verify(memberRef)).status, 409);
    verified.set(memberRef, { email: buyer.email, amount: 1 });
    assert.equal(
      (await verify(memberRef)).status,
      409,
      "Wrong payment amount cannot grant membership",
    );
    assert.equal((await verify(memberRef, stranger.cookie)).status, 404);
    verified.set(memberRef, { email: buyer.email, amount: 2000000 });
    assert.equal((await verify(memberRef)).status, 200);
    const expiry = (await db.user.findUniqueOrThrow({ where: { id: buyer.id } })).membership_until;
    assert.ok(expiry);
    await Promise.all([verify(memberRef), verify(memberRef)]);
    assert.equal(
      (await db.user.findUniqueOrThrow({ where: { id: buyer.id } })).membership_until!.getTime(),
      expiry.getTime(),
      "Replay cannot extend membership twice",
    );
    assert.equal(
      (await request(app).get(`/api/items/${free.id}`).set("Cookie", buyer.cookie)).body
        .donor_whatsapp,
      seller.phone,
    );
    const paid = await item(seller.id, 500000);
    assert.equal(
      (await request(app).get(`/api/items/${paid.id}`).set("Cookie", buyer.cookie)).body
        .donor_whatsapp,
      "",
      "Paid seller contact is not leaked before checkout",
    );
    process.env["PAYSTACK_HOLDING_APPROVED"] = "false";
    assert.equal(
      (
        await request(app)
          .post("/api/orders")
          .set("Cookie", buyer.cookie)
          .send({ item_id: paid.id })
      ).status,
      503,
    );
    process.env["PAYSTACK_HOLDING_APPROVED"] = "true";
    process.env["PAYSTACK_SECRET_KEY"] = "sk_live_mock_no_real_calls";
    assert.equal(
      (
        await request(app)
          .post("/api/orders")
          .set("Cookie", buyer.cookie)
          .send({ item_id: paid.id })
      ).status,
      503,
      "Live Paystack cannot enable unsupported escrow",
    );
    process.env["PAYSTACK_SECRET_KEY"] = "sk_test_doinggood_mock_only";
    assert.equal(
      (
        await request(app)
          .post("/api/orders")
          .set("Cookie", seller.cookie)
          .send({ item_id: paid.id })
      ).status,
      400,
    );
    const begin = await request(app)
      .post("/api/orders")
      .set("Cookie", buyer.cookie)
      .send({ item_id: paid.id });
    assert.equal(begin.status, 200);
    assert.equal(
      (
        await request(app)
          .post("/api/orders")
          .set("Cookie", stranger.cookie)
          .send({ item_id: paid.id })
      ).status,
      409,
    );
    assert.equal(
      (
        await request(app)
          .patch(`/api/items/${paid.id}/status`)
          .set("Cookie", seller.cookie)
          .send({ status: "available" })
      ).status,
      409,
    );
    const order = await db.order.findUniqueOrThrow({ where: { reference: begin.body.reference } });
    verified.set(order.reference, { email: buyer.email, amount: order.amount });
    const raw = JSON.stringify({ event: "charge.success", data: { reference: order.reference } });
    assert.equal(
      (
        await request(app)
          .post("/api/payments/webhook")
          .set("Content-Type", "application/json")
          .send(raw)
      ).status,
      403,
    );
    const signature = createHmac("sha512", process.env["PAYSTACK_SECRET_KEY"]!)
      .update(raw)
      .digest("hex");
    assert.equal(
      (
        await request(app)
          .post("/api/payments/webhook")
          .set("Content-Type", "application/json")
          .set("x-paystack-signature", signature)
          .send(raw)
      ).status,
      200,
    );
    assert.equal(
      (await request(app).get("/api/orders").set("Cookie", stranger.cookie)).body.orders.length,
      0,
    );
    const act = (id: string, action: string, cookie: string, body = {}) =>
      request(app).post(`/api/orders/${id}/${action}`).set("Cookie", cookie).send(body);
    assert.equal(
      (await act(order.id, "deliver", buyer.cookie, { note: "Handed over at Yaba" })).status,
      409,
    );
    assert.equal(
      (await act(order.id, "deliver", seller.cookie, { note: "Handed over at Yaba" })).status,
      200,
    );
    emailFails = true;
    await processCommerce(itemIds);
    assert.equal(
      (await db.order.findUniqueOrThrow({ where: { id: order.id } })).release_at,
      null,
      "No clock without successful buyer notice",
    );
    emailFails = false;
    await processCommerce(itemIds);
    const delivered = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    assert.ok(
      delivered.release_at && delivered.release_at.getTime() - Date.now() > REVIEW_MS - 30000,
    );
    assert.equal(
      (await act(order.id, "dispute", buyer.cookie, { reason: "The item has not arrived" })).status,
      200,
    );
    await db.order.update({ where: { id: order.id }, data: { release_at: new Date(0) } });
    await processCommerce(itemIds);
    assert.equal(transferCalls, 0, "Expired disputed orders never release");
    assert.equal(
      (
        await act(order.id, "resolve", seller.cookie, {
          outcome: "release",
          note: "I want the payout now",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await act(order.id, "resolve", admin.cookie, {
          outcome: "release",
          note: "Buyer provided a signed receipt after review",
        })
      ).status,
      200,
    );
    invalidTransfer = true;
    await processCommerce(itemIds);
    assert.equal(
      (await db.order.findUniqueOrThrow({ where: { id: order.id } })).status,
      "payout_processing",
      "Mismatched provider amount cannot complete payout",
    );
    invalidTransfer = false;
    await processCommerce(itemIds);
    await processCommerce(itemIds);
    assert.equal(transferCalls, 1);
    assert.equal(
      (await db.order.findUniqueOrThrow({ where: { id: order.id } })).status,
      "released",
    );
    assert.equal((await db.item.findUniqueOrThrow({ where: { id: paid.id } })).status, "sold");
    const refundItem = await item(seller.id, 500000);
    const refundOrder = await db.order.create({
      data: {
        item_id: refundItem.id,
        buyer_id: buyer.id,
        seller_id: seller.id,
        reference: `dg-order-${randomUUID()}`,
        transfer_reference: `dg-payout-${randomUUID()}`,
        recipient: "RCP_mock",
        amount: 500000,
        status: "disputed",
      },
    });
    await act(refundOrder.id, "resolve", admin.cookie, {
      outcome: "refund",
      note: "Seller confirmed delivery never happened",
    });
    await processCommerce(itemIds);
    await processCommerce(itemIds);
    assert.equal(refundCalls, 1);
    assert.equal(
      (await db.order.findUniqueOrThrow({ where: { id: refundOrder.id } })).status,
      "refunded",
    );
    const timedItem = await item(seller.id, 500000);
    const timed = await db.order.create({
      data: {
        item_id: timedItem.id,
        buyer_id: buyer.id,
        seller_id: seller.id,
        reference: `dg-order-${randomUUID()}`,
        transfer_reference: `dg-payout-${randomUUID()}`,
        recipient: "RCP_mock",
        amount: 500000,
        status: "delivered",
        release_at: new Date(Date.now() - 1),
      },
    });
    assert.equal(
      (await act(timed.id, "dispute", buyer.cookie, { reason: "After the review window" })).status,
      409,
    );
    await processCommerce(itemIds);
    assert.equal(
      (await db.order.findUniqueOrThrow({ where: { id: timed.id } })).status,
      "released",
    );
    const earlyItem = await item(seller.id, 500000);
    const early = await db.order.create({
      data: {
        item_id: earlyItem.id,
        buyer_id: buyer.id,
        seller_id: seller.id,
        reference: `dg-order-${randomUUID()}`,
        transfer_reference: `dg-payout-${randomUUID()}`,
        recipient: "RCP_mock",
        amount: 500000,
        status: "delivered",
        release_at: new Date(Date.now() + REVIEW_MS),
      },
    });
    await processCommerce(itemIds);
    assert.equal(
      (await db.order.findUniqueOrThrow({ where: { id: early.id } })).status,
      "delivered",
      "Never release before the review deadline",
    );
    assert.equal((await act(early.id, "confirm", stranger.cookie)).status, 409);
    assert.equal((await act(early.id, "confirm", buyer.cookie)).status, 200);
    await processCommerce(itemIds);
    assert.equal(
      (await db.order.findUniqueOrThrow({ where: { id: early.id } })).status,
      "released",
    );
    const lateItem = await item(seller.id, 500000);
    await db.item.update({ where: { id: lateItem.id }, data: { status: "reserved" } });
    const late = await db.order.create({
      data: {
        item_id: lateItem.id,
        buyer_id: buyer.id,
        seller_id: seller.id,
        reference: `dg-order-${randomUUID()}`,
        transfer_reference: `dg-payout-${randomUUID()}`,
        recipient: "RCP_mock",
        amount: 500000,
        created_at: new Date(Date.now() - 31 * 60000),
      },
    });
    await processCommerce(itemIds);
    assert.equal(
      (await db.item.findUniqueOrThrow({ where: { id: lateItem.id } })).status,
      "available",
    );
    const newCheckout = await request(app)
      .post("/api/orders")
      .set("Cookie", stranger.cookie)
      .send({ item_id: lateItem.id, amount: 1 });
    assert.equal(newCheckout.status, 200);
    verified.set(late.reference, { email: buyer.email, amount: 500000 });
    await verify(late.reference);
    assert.equal(
      (await db.order.findUniqueOrThrow({ where: { id: late.id } })).status,
      "refund_pending",
    );
    await processCommerce(itemIds);
    assert.equal((await db.order.findUniqueOrThrow({ where: { id: late.id } })).status, "refunded");
    assert.equal(
      (await db.item.findUniqueOrThrow({ where: { id: lateItem.id } })).status,
      "reserved",
      "Late refund cannot clear another buyer's reservation",
    );
    assert.equal(
      (await db.order.findUniqueOrThrow({ where: { reference: newCheckout.body.reference } }))
        .amount,
      500000,
      "Checkout uses server price, never buyer input",
    );
  } finally {
    await db.order.deleteMany({ where: { item_id: { in: itemIds } } });
    await db.purchase.deleteMany({ where: { user_id: { in: userIds } } });
    await db.item.deleteMany({ where: { id: { in: itemIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    process.env = original;
    await db.$disconnect();
  }
});
