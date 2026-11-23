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
  process.env["PAYSTACK_SECRET_KEY"] = "sk_live_mock_no_real_calls";
  process.env["PAYMENTS_ENABLED"] = "true";
  process.env["PAYMENT_HOLDING_APPROVED"] = "true";
  const marker = `commerce-test-${randomUUID()}`;
  const userIds: string[] = [];
  const itemIds: string[] = [];
  const verified = new Map<string, { email: string; amount: number; domain?: string }>();
  const transfers = new Map<string, { amount: number; recipient: string }>();
  let transferCalls = 0;
  let refundCalls = 0;
  let emailFails = false;
  let invalidTransfer = false;
  let bankResolveStatus: number | null = null;
  let bankResolveCalls = 0;
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
    if (path === "/bank") {
      data = [
        { name: "Example Bank", code: "058" },
        { name: "Example Bank Duplicate", code: "058" },
      ];
    } else if (path === "/bank/resolve") {
      bankResolveCalls++;
      if (bankResolveStatus !== null)
        return new Response(JSON.stringify({ status: false }), {
          status: bankResolveStatus,
          ...(bankResolveStatus === 429
            ? {
                headers: {
                  "x-ratelimit-limit": "1500",
                  "x-ratelimit-remaining": "0",
                  "x-ratelimit-reset": "30",
                },
              }
            : {}),
        });
      data = { account_name: "Tolu Ade" };
    } else if (path === "/transaction/initialize") {
      if (String(new Headers(init?.headers).get("authorization")).startsWith("Bearer sk_live_")) {
        assert.equal(body.subaccount, undefined);
        assert.equal(body.bearer, undefined);
      }
      data = { authorization_url: `https://checkout.paystack.com/mock-${body.reference}` };
    } else if (path.startsWith("/transaction/verify/")) {
      const reference = path.split("/").at(-1)!;
      const payment = verified.get(reference);
      data = {
        status: payment ? "success" : "pending",
        reference,
        amount: payment?.amount,
        currency: "NGN",
        domain: payment?.domain,
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
    const payoutLookup = (accountNumber = "1111111111") =>
      request(app)
        .get(`/api/payout/resolve?bank_code=058&account_number=${accountNumber}`)
        .set("Cookie", seller.cookie);
    const resolvedPayout = await payoutLookup();
    assert.equal(resolvedPayout.status, 200);
    assert.deepEqual(resolvedPayout.body, { account_name: "Tolu Ade" });
    assert.equal((await payoutLookup()).status, 200);
    assert.equal(bankResolveCalls, 1, "Successful payout lookups are cached");
    bankResolveStatus = 400;
    const invalidPayout = await payoutLookup("2222222222");
    assert.equal(invalidPayout.status, 422);
    assert.match(invalidPayout.body.error, /Check the selected bank and 10-digit account number/);
    bankResolveStatus = 429;
    const rateLimitedPayout = await payoutLookup("3333333333");
    assert.equal(rateLimitedPayout.status, 429);
    assert.match(rateLimitedPayout.body.error, /try again in 30 seconds/);
    assert.equal((await payoutLookup("4444444444")).status, 429);
    assert.equal(bankResolveCalls, 3, "The Paystack cooldown suppresses further requests");
    bankResolveStatus = null;
    const free = await item(seller.id, 0);
    const saveContact = () =>
      request(app)
        .post("/api/giver-contacts")
        .set("Cookie", buyer.cookie)
        .send({ item_id: free.id });
    const saved = await Promise.all([saveContact(), saveContact()]);
    assert.deepEqual(
      saved.map((result) => result.status),
      [200, 200],
    );
    const contactHistory = (cookie: string) =>
      request(app).get("/api/giver-contacts").set("Cookie", cookie);
    assert.deepEqual(
      (await contactHistory(buyer.cookie)).body.map(
        (entry: { item_id: string; contact: string }) => [entry.item_id, entry.contact],
      ),
      [[free.id, seller.phone]],
    );
    assert.deepEqual((await contactHistory(stranger.cookie)).body, []);
    assert.equal(
      (await request(app).get(`/api/items/${free.id}`).set("Cookie", buyer.cookie)).body
        .donor_whatsapp,
      seller.phone,
    );
    process.env["PAYMENTS_ENABLED"] = "false";
    assert.equal(
      (await request(app).post("/api/membership/checkout").set("Cookie", buyer.cookie).send({}))
        .status,
      404,
    );
    assert.equal(
      (await request(app).get(`/api/items/${free.id}`).set("Cookie", buyer.cookie)).body
        .donor_whatsapp,
      seller.phone,
    );
    process.env["PAYMENTS_ENABLED"] = "true";
    assert.equal(
      (await request(app).post("/api/membership/checkout").set("Cookie", buyer.cookie).send({}))
        .status,
      404,
    );
    assert.equal((await request(app).get("/api/commerce")).body.membership_checkout, undefined);
    // Preserve verification of historical receipts without selling new memberships.
    const legacyPurchase = await db.purchase.create({
      data: { user_id: buyer.id, reference: `dg-member-${randomUUID()}`, amount: 2000000 },
    });
    const memberRef = legacyPurchase.reference;
    const verify = (reference: string, cookie = buyer.cookie) =>
      request(app).post("/api/payments/verify").set("Cookie", cookie).send({ reference });
    assert.equal((await verify(memberRef)).status, 409);
    verified.set(memberRef, { email: buyer.email, amount: 1 });
    assert.equal(
      (await verify(memberRef)).status,
      409,
      "Wrong payment amount cannot grant membership",
    );
    verified.set(memberRef, { email: buyer.email, amount: 2000001 });
    assert.equal(
      (await verify(memberRef)).status,
      200,
      "A provider fee collected from the buyer must not invalidate a fully paid order",
    );
    await db.purchase.update({
      where: { id: legacyPurchase.id },
      data: { status: "pending", paid_at: null },
    });
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
    const bankList = await request(app).get("/api/payout/banks").set("Cookie", seller.cookie);
    assert.equal(bankList.status, 200);
    assert.deepEqual(bankList.body, [{ name: "Example Bank", code: "058" }]);
    assert.equal(
      (await request(app).get(`/api/items/${paid.id}`).set("Cookie", buyer.cookie)).body
        .donor_whatsapp,
      "",
      "Paid seller contact is not leaked before checkout",
    );
    process.env["PAYMENT_HOLDING_APPROVED"] = "false";
    assert.equal(
      (
        await request(app)
          .post("/api/orders")
          .set("Cookie", buyer.cookie)
          .send({ item_id: paid.id })
      ).status,
      503,
    );
    process.env["PAYMENT_HOLDING_APPROVED"] = "true";
    assert.equal((await request(app).get("/api/commerce")).body.protected_checkout, true);
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
    const buyerOrder = (await request(app).get("/api/orders").set("Cookie", buyer.cookie)).body
      .orders[0];
    assert.equal(buyerOrder.paid_amount, order.amount);
    assert.ok(buyerOrder.paid_at);
    assert.equal(
      buyerOrder.contact,
      seller.phone,
    );
    assert.equal(
      (await request(app).get("/api/orders").set("Cookie", admin.cookie)).body.orders[0].contact,
      "",
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
      409,
    );
    // Exercise reconciliation of an already-authorized payout independently of dispute handling.
    await db.order.update({ where: { id: order.id }, data: { status: "release_pending" } });
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
    assert.ok((await db.order.findUniqueOrThrow({ where: { id: order.id } })).release_at);
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
    const refundResolution = await act(refundOrder.id, "resolve", admin.cookie, {
      outcome: "refund",
      note: "Seller confirmed delivery never happened",
    });
    assert.equal(refundResolution.status, 200);
    assert.equal(
      (await db.order.findUniqueOrThrow({ where: { id: refundOrder.id } })).status,
      "refund_pending",
    );
    await processCommerce(itemIds);
    assert.equal(refundCalls, 1, "A pending refund should be sent to the mocked provider");
    await processCommerce(itemIds);
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

test("order messaging stays between the buyer and the seller", async () => {
  const marker = `order-messages-${randomUUID()}`;
  const userIds: string[] = [];
  const itemIds: string[] = [];
  const app = createApp();
  async function identity(name: string) {
    const user = await db.user.create({
      data: { email: `${marker}-${name}@example.com`, full_name: name, phone: "+2348012345678" },
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
  try {
    const seller = await identity("seller");
    const buyer = await identity("buyer");
    const stranger = await identity("stranger");
    const listing = await db.item.create({
      data: {
        owner_id: seller.id,
        title: marker,
        description: "Messaging test item",
        category: "other",
        condition: "good",
        location: "Lagos",
        photos: [],
        price_kobo: 500000,
      },
    });
    itemIds.push(listing.id);
    const order = await db.order.create({
      data: {
        item_id: listing.id,
        buyer_id: buyer.id,
        seller_id: seller.id,
        reference: `dg-order-${randomUUID()}`,
        transfer_reference: `dg-payout-${randomUUID()}`,
        recipient: "RCP_mock",
        amount: 500000,
        status: "paid",
        paid_at: new Date(),
      },
    });
    const send = (cookie: string, text: string) =>
      request(app).post(`/api/orders/${order.id}/messages`).set("Cookie", cookie).send({ text });
    const read = (cookie: string) =>
      request(app).get(`/api/orders/${order.id}/messages`).set("Cookie", cookie);
    assert.equal((await read(stranger.cookie)).status, 404, "Strangers cannot read an order");
    assert.equal((await send(stranger.cookie, "Hello")).status, 404, "Strangers cannot post");
    assert.equal((await send(buyer.cookie, "   ")).status, 400, "Empty messages are rejected");
    const buyerMessage = await send(buyer.cookie, "  On my way to Yaba.  ");
    assert.equal(buyerMessage.status, 201);
    assert.equal(buyerMessage.body.text, "On my way to Yaba.");
    assert.equal(buyerMessage.body.sender_id, buyer.id);
    assert.equal((await send(seller.cookie, "See you soon")).status, 201);
    const thread = await read(seller.cookie);
    assert.equal(thread.status, 200);
    assert.deepEqual(
      thread.body.map((message: { text: string }) => message.text),
      ["On my way to Yaba.", "See you soon"],
    );
    assert.equal((await read(buyer.cookie)).body.length, 2);
  } finally {
    await db.order.deleteMany({ where: { item_id: { in: itemIds } } });
    await db.item.deleteMany({ where: { id: { in: itemIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
  }
});
