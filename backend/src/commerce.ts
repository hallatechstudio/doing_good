import type { Express, Request, Response } from "express";
import { createHmac, randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "./db.js";
import { HttpError } from "./errors.js";
import { sendEmail } from "./email.js";
import { REVIEW_MS, membershipExpiry, validSignature } from "./payment-rules.js";
import {
  checkout,
  marketplaceEnabled,
  paystack,
  PaystackError,
  requirePayments,
  verifyPayment,
} from "./paystack.js";

type Identity = { id: string; email: string; full_name: string; phone: string; payout_name: string | null };
type Authenticate = (req: Request) => Promise<Identity>;
const idInput = z.string().uuid();
const referenceInput = z.string().regex(/^dg-(member|order)-[a-f0-9-]{36}$/);
const payoutNameCache = new Map<string, { accountName: string; expiresAt: number }>();
const payoutNameRequests = new Map<string, Promise<string>>();
let payoutBankCache: { banks: { name: string; code: string }[]; expiresAt: number } | undefined;
let payoutVerificationBlockedUntil = 0;
export const isAdmin = (email: string) =>
  (process.env["COMMERCE_ADMIN_EMAILS"] || "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());

async function resolvePayoutAccountName(bankCode: string, accountNumber: string) {
  const cacheKey = createHmac("sha256", process.env["PAYSTACK_SECRET_KEY"] || "payout-cache")
    .update(`${bankCode}:${accountNumber}`)
    .digest("hex");
  const cached = payoutNameCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.accountName;
  if (cached) payoutNameCache.delete(cacheKey);

  const pending = payoutNameRequests.get(cacheKey);
  if (pending) return pending;

  const retryIn = Math.ceil((payoutVerificationBlockedUntil - Date.now()) / 1000);
  if (retryIn > 0)
    throw new HttpError(
      429,
      `Bank verification is rate-limited. Please try again in ${retryIn} seconds.`,
    );

  const request = (async () => {
    try {
      const resolved = await paystack<{ account_name: string }>(
        `/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
      );
      if (payoutNameCache.size >= 500) {
        const oldest = payoutNameCache.keys().next().value;
        if (oldest) payoutNameCache.delete(oldest);
      }
      payoutNameCache.set(cacheKey, {
        accountName: resolved.account_name,
        expiresAt: Date.now() + 5 * 60 * 1000,
      });
      return resolved.account_name;
    } catch (error) {
      console.error("Payout account verification failed", {
        type: error instanceof Error ? error.name : "Unknown",
        providerStatus: error instanceof PaystackError ? error.status : undefined,
        providerLimit: error instanceof PaystackError ? error.rateLimit?.limit : undefined,
        providerRemaining: error instanceof PaystackError ? error.rateLimit?.remaining : undefined,
        providerResetSeconds:
          error instanceof PaystackError ? error.rateLimit?.resetSeconds : undefined,
      });
      if (error instanceof PaystackError && error.status === 429) {
        const retryAfter = Math.max(1, error.retryAfterSeconds ?? 60);
        payoutVerificationBlockedUntil = Math.max(
          payoutVerificationBlockedUntil,
          Date.now() + retryAfter * 1000,
        );
        throw new HttpError(
          429,
          `Bank verification is rate-limited. Please try again in ${retryAfter} seconds.`,
        );
      }
      if (error instanceof PaystackError && [400, 404, 422].includes(error.status))
        throw new HttpError(
          422,
          "We could not verify these bank details. Check the selected bank and 10-digit account number.",
        );
      throw new HttpError(503, "Bank verification is temporarily unavailable. Please try again.");
    }
  })();
  payoutNameRequests.set(cacheKey, request);
  try {
    return await request;
  } finally {
    payoutNameRequests.delete(cacheKey);
  }
}

const naira = (kobo: number) =>
  `₦${(kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function sendOrderPaidEmails(order: {
  reference: string;
  amount: number;
  buyer: { email: string; full_name: string };
  seller: { email: string; full_name: string };
  item: { title: string };
}) {
  const ordersUrl = new URL(
    "/orders",
    process.env["APP_URL"] || "http://localhost:5173",
  ).toString();
  const amount = naira(order.amount);
  const results = await Promise.allSettled([
    sendEmail(
      order.seller.email,
      `Someone just paid for ${order.item.title}`,
      `Someone just paid for ${order.item.title}.\n\nReceiver: ${order.buyer.full_name}\nAmount: ${amount}\nPayment reference: ${order.reference}\n\nHand over the item, then confirm delivery from your sales at ${ordersUrl}. We only release the payment to you after the receiver confirms they received the item.`,
    ),
    sendEmail(
      order.buyer.email,
      `Your DoingGood receipt for ${order.item.title}`,
      `Thanks for your payment. This is your receipt.\n\nItem: ${order.item.title}\nGiver: ${order.seller.full_name}\nAmount: ${amount}\nPayment reference: ${order.reference}\n\nWe only release payment to the giver after you confirm you have received the product. Message the giver to arrange pickup or delivery, then confirm receipt from your Order history: ${ordersUrl}`,
    ),
  ]);
  for (const result of results)
    if (result.status === "rejected")
      console.error("Order payment email failed", {
        type: result.reason instanceof Error ? result.reason.name : "Unknown",
      });
}

export async function recordPayment(reference: string) {
  const payment = await verifyPayment(reference);
  if (payment.status !== "success")
    throw new HttpError(409, "Payment is not confirmed yet. Try verifying again shortly.");
  const purchase = await db.purchase.findUnique({ where: { reference }, include: { user: true } });
  const order = purchase
    ? null
    : await db.order.findUnique({
        where: { reference },
        include: { buyer: true, seller: true, item: true },
      });
  if (!purchase && !order) return;
  const amount = purchase?.amount ?? order!.amount;
  const email = purchase?.user.email ?? order!.buyer.email;
  if (
    payment.reference !== reference ||
    payment.amount < amount ||
    payment.currency !== "NGN" ||
    payment.customer.email.toLowerCase() !== email.toLowerCase()
  )
    throw new HttpError(
      409,
      "Payment details do not match. Contact support with your payment reference.",
    );
  if (purchase) {
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${purchase.user_id}::uuid FOR UPDATE`;
      const claimed = await tx.purchase.updateMany({
        where: { id: purchase.id, status: "pending" },
        data: { status: "paid", paid_at: new Date() },
      });
      if (!claimed.count) return;
      const member = await tx.user.findUniqueOrThrow({ where: { id: purchase.user_id } });
      await tx.user.update({
        where: { id: member.id },
        data: { membership_until: membershipExpiry(member.membership_until) },
      });
    });
  } else if (order) {
    const claimed = await db.$transaction(async (tx) => {
      const paid_at = payment.paid_at ? new Date(payment.paid_at) : new Date();
      const paid = await tx.order.updateMany({
        where: { id: order.id, status: "pending_payment" },
        data: { status: "paid", paid_at, paid_amount: payment.amount },
      });
      if (!paid.count) {
        await tx.order.updateMany({
          where: { id: order.id, status: "payment_expired" },
          data: { status: "refund_pending", paid_at, paid_amount: payment.amount },
        });
        return false;
      }
      const item = await tx.item.findUnique({ where: { id: order.item_id } });
      if (item)
        await tx.item.update({
          where: { id: item.id },
          data: { status: item.quantity > 0 ? "available" : "sold" },
        });
      return true;
    });
    // Emails go out once, immediately after the first successful payment transition.
    if (claimed) await sendOrderPaidEmails(order);
  }
}

export async function paymentWebhook(req: Request, res: Response) {
  const raw = req.body as Buffer;
  if (
    !Buffer.isBuffer(raw) ||
    !validSignature(
      raw,
      req.get("x-paystack-signature") || "",
      process.env["PAYSTACK_SECRET_KEY"] || "",
    )
  )
    throw new HttpError(403, "Invalid webhook signature.");
  const event = JSON.parse(raw.toString()) as { event?: string; data?: { reference?: string } };
  const reference = event.data?.reference;
  if (event.event === "charge.success" && reference && referenceInput.safeParse(reference).success)
    await recordPayment(reference);
  if (event.event?.startsWith("transfer.") && reference) await processWalletWithdrawals();
  // Transfer and refund events are reconciled against the provider by the worker,
  // rather than trusting event ordering or treating a request as a completed payout.
  res.json({ ok: true });
}

async function orderForParticipant(req: Request, authenticate: Authenticate, id: string) {
  const member = await authenticate(req);
  const order = await db.order.findUnique({ where: { id: idInput.parse(id) } });
  if (!order || (order.buyer_id !== member.id && order.seller_id !== member.id))
    throw new HttpError(404, "Order not found.");
  return { member, order };
}

export function mountCommerce(app: Express, authenticate: Authenticate) {
  app.get("/api/commerce", (_req, res) =>
    res.json({
      protected_checkout: marketplaceEnabled(),
    }),
  );
  app.post("/api/payments/verify", async (req, res) => {
    const member = await authenticate(req);
    const { reference } = z.object({ reference: referenceInput }).parse(req.body);
    const purchase = await db.purchase.findUnique({ where: { reference } });
    const order = purchase ? null : await db.order.findUnique({ where: { reference } });
    if ((purchase?.user_id ?? order?.buyer_id) !== member.id)
      throw new HttpError(404, "Payment not found.");
    await recordPayment(reference);
    res.json({ ok: true });
  });
  app.get("/api/payout/banks", async (req, res) => {
    await authenticate(req);
    requirePayments(true);
    let banks = payoutBankCache?.expiresAt && payoutBankCache.expiresAt > Date.now()
      ? payoutBankCache.banks
      : undefined;
    if (!banks) {
      banks = [];
      for (let page = 1; page <= 10; page++) {
        const batch = await paystack<{ name: string; code: string }[]>(
          `/bank?country=nigeria&currency=NGN&perPage=100&page=${page}`,
        );
        banks.push(...batch);
        if (batch.length < 100) break;
      }
      payoutBankCache = { banks, expiresAt: Date.now() + 6 * 60 * 60 * 1000 };
    }
    const uniqueBanks = new Map<string, { name: string; code: string }>();
    for (const { name, code } of banks) {
      if (!uniqueBanks.has(code)) uniqueBanks.set(code, { name, code });
    }
    res.json([...uniqueBanks.values()]);
  });
  app.get("/api/payout/resolve", async (req, res) => {
    await authenticate(req);
    requirePayments(true);
    const input = z
      .object({
        bank_code: z.string().regex(/^\d{3,6}$/),
        account_number: z.string().regex(/^\d{10}$/),
      })
      .parse(req.query);
    res.json({
      account_name: await resolvePayoutAccountName(input.bank_code, input.account_number),
    });
  });
  app.post("/api/payout/account", async (req, res) => {
    const member = await authenticate(req);
    requirePayments(true);
    const input = z
      .object({
        bank_code: z.string().regex(/^\d{3,6}$/),
        account_number: z.string().regex(/^\d{10}$/),
      })
      .parse(req.body);
    const accountName = await resolvePayoutAccountName(input.bank_code, input.account_number);
    const recipient = (
      await paystack<{ recipient_code: string }>("/transferrecipient", {
        type: "nuban",
        name: accountName,
        ...input,
        currency: "NGN",
      })
    ).recipient_code;
    // Store the provider token and verified name, never the full bank account number.
    await db.user.update({
      where: { id: member.id },
      data: { payout_recipient: recipient, payout_name: accountName },
    });
    res.json({ name: accountName });
  });
  app.post("/api/orders", async (req, res) => {
    const buyer = await authenticate(req);
    requirePayments(true);
    if (!/^\+[1-9]\d{7,14}$/.test(buyer.phone))
      throw new HttpError(400, "Add a WhatsApp number so the seller can arrange the handoff.");
    const { item_id, fulfillment_method } = z
      .object({
        item_id: idInput,
        fulfillment_method: z.enum(["pickup", "delivery"]).default("pickup"),
      })
      .parse(req.body);
    let order = await db.order.findFirst({
      where: { item_id, buyer_id: buyer.id, status: "pending_payment" },
    });
    if (!order)
      order = await db.$transaction(async (tx) => {
        const item = await tx.item.findUnique({ where: { id: item_id }, include: { owner: true } });
        if (!item || item.price_kobo <= 0) throw new HttpError(400, "Choose a paid item.");
        if (item.owner_id === buyer.id) throw new HttpError(400, "You cannot buy your own item.");
        if (
          fulfillment_method === "pickup" ? !item.pickup_available : item.delivery_fee_kobo === null
        )
          throw new HttpError(409, "This handoff option is unavailable for the listing.");
        const deliveryFee = fulfillment_method === "delivery" ? item.delivery_fee_kobo! : 0;
        const reserved = await tx.item.updateMany({
          where: { id: item_id, status: { in: ["available", "reserved"] }, quantity: { gt: 0 } },
          data: { status: "reserved", quantity: { decrement: 1 } },
        });
        if (!reserved.count)
          throw new HttpError(409, "This item is already reserved or no longer available.");
        return tx.order.create({
          data: {
            item_id,
            buyer_id: buyer.id,
            seller_id: item.owner_id,
            amount: item.price_kobo + deliveryFee,
            fulfillment_method,
            delivery_fee_kobo: deliveryFee,
            // Every sale settles into the seller's DoingGood wallet first. A bank recipient is
            // attached only when the seller explicitly makes a withdrawal.
            recipient: "WALLET_PENDING",
            reference: `dg-order-${randomUUID()}`,
            transfer_reference: `dg-payout-${randomUUID()}`,
          },
        });
      });
    if (order.fulfillment_method !== fulfillment_method)
      throw new HttpError(409, "Continue the existing payment from Order history.");
    if (!order.checkout_url) {
      const session = await checkout(
        buyer.email,
        order.amount,
        order.reference,
        undefined,
      );
      order = await db.order.update({
        where: { id: order.id },
        data: { checkout_url: session.authorization_url },
      });
    }
    res.json({ url: order.checkout_url, reference: order.reference });
  });
  app.get("/api/orders", async (req, res) => {
    const member = await authenticate(req);
    const admin = isAdmin(member.email);
    const orders = await db.order.findMany({
      where: admin ? {} : { OR: [{ buyer_id: member.id }, { seller_id: member.id }] },
      include: {
        item: { select: { title: true, photos: true } },
        buyer: { select: { full_name: true, phone: true } },
        seller: { select: { full_name: true, phone: true } },
      },
      orderBy: { created_at: "desc" },
      take: 100,
    });
    res.json({
      admin,
      user_id: member.id,
      orders: orders.map((o) => ({
        id: o.id,
        item_id: o.item_id,
        title: o.item.title,
        photo: o.item.photos[0],
        amount: o.amount,
        fulfillment_method: o.fulfillment_method,
        delivery_fee_kobo: o.delivery_fee_kobo,
        handoff_status: o.handoff_status,
        buyer_id: o.buyer_id,
        seller_id: o.seller_id,
        status: o.status,
        can_track_handoff: false,
        reference: o.reference,
        created_at: o.created_at,
        paid_at: o.paid_at,
        paid_amount: o.paid_amount,
        release_at: o.status === "delivered" ? o.release_at : null,
        accountability_until:
          o.status === "released" && o.release_at
            ? new Date(o.release_at.getTime() + REVIEW_MS)
            : null,
        held_payment:
          Boolean(o.paid_at),
        wallet_release: o.recipient === "WALLET_PENDING",
        dispute_reason: o.dispute_reason,
        resolution_note: o.resolution_note,
        buyer: o.buyer.full_name,
        seller: o.seller.full_name,
        contact:
          !o.paid_at
            ? ""
            : member.id === o.seller_id
              ? o.buyer.phone
              : member.id === o.buyer_id
                ? o.seller.phone
                : "",
      })),
    });
  });
  app.get("/api/wallet", async (req, res) => {
    const member = await authenticate(req);
    const orders = await db.order.findMany({
      where: { seller_id: member.id, recipient: "WALLET_PENDING", status: { in: ["paid", "delivery_pending", "delivered", "release_pending", "payout_processing", "released"] } },
      select: { id: true, item: { select: { title: true } }, amount: true, status: true, created_at: true },
      orderBy: { created_at: "desc" }, take: 100,
    });
    const withdrawals = await db.walletWithdrawal.findMany({
      where: { user_id: member.id },
      select: { id: true, amount: true, status: true, created_at: true, completed_at: true },
      orderBy: { created_at: "desc" }, take: 100,
    });
    const released = orders.filter((order) => order.status === "released").reduce((sum, order) => sum + Math.floor(order.amount * 0.8), 0);
    const committed = withdrawals.filter((withdrawal) => ["queued", "processing", "review", "completed"].includes(withdrawal.status)).reduce((sum, withdrawal) => sum + withdrawal.amount, 0);
    const available = Math.max(0, released - committed);
    const pending = orders.filter((order) => order.status !== "released").reduce((sum, order) => sum + Math.floor(order.amount * 0.8), 0);
    res.json({
      available,
      pending,
      commission_rate: 20,
      payout_name: member.payout_name,
      transactions: [
        ...orders.map((order) => ({ id: order.id, title: order.item.title, amount: Math.floor(order.amount * 0.8), status: order.status === "released" ? "available" : "pending", created_at: order.created_at, kind: "sale" })),
        ...withdrawals.map((withdrawal) => ({ id: withdrawal.id, title: "Withdrawal", amount: -withdrawal.amount, status: withdrawal.status, created_at: withdrawal.created_at, kind: "withdrawal" })),
      ].sort((a, b) => b.created_at.getTime() - a.created_at.getTime()),
    });
  });
  app.post("/api/wallet/withdrawals", async (req, res) => {
    const member = await authenticate(req);
    requirePayments(true);
    const { amount } = z.object({ amount: z.number().int().min(100) }).parse(req.body);
    if (!member.payout_name) throw new HttpError(409, "Add and verify a bank account before withdrawing.");
    const withdrawal = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${member.id}::uuid FOR UPDATE`;
      const [sales, reserved] = await Promise.all([
        tx.order.findMany({ where: { seller_id: member.id, recipient: "WALLET_PENDING", status: "released" }, select: { amount: true } }),
        tx.walletWithdrawal.aggregate({ where: { user_id: member.id, status: { in: ["queued", "processing", "review", "completed"] } }, _sum: { amount: true } }),
      ]);
      const released = sales.reduce((sum, sale) => sum + Math.floor(sale.amount * 0.8), 0);
      const available = Math.max(0, released - (reserved._sum.amount ?? 0));
      if (amount > available) throw new HttpError(409, "This amount is no longer available to withdraw.");
      const user = await tx.user.findUniqueOrThrow({ where: { id: member.id }, select: { payout_recipient: true } });
      if (!user.payout_recipient) throw new HttpError(409, "Add and verify a bank account before withdrawing.");
      return tx.walletWithdrawal.create({
        data: { user_id: member.id, amount, recipient: user.payout_recipient, reference: `dg-withdrawal-${randomUUID()}` },
      });
    });
    void processWalletWithdrawals([withdrawal.id]);
    res.status(202).json({ id: withdrawal.id, status: withdrawal.status });
  });
  app.get("/api/giver-contacts", async (req, res) => {
    const member = await authenticate(req);
    const contacts = await db.itemRequest.findMany({
      where: { requester_user_id: member.id, item: { price_kobo: 0 } },
      include: { item: { include: { owner: { select: { full_name: true, phone: true } } } } },
      orderBy: { created_at: "desc" },
      take: 100,
    });
    res.json(
      contacts.map(({ item, created_at }) => ({
        item_id: item.id,
        title: item.title,
        giver: item.owner.full_name,
        contact: item.price_kobo === 0 ? item.owner.phone : "",
        created_at,
      })),
    );
  });
  app.post("/api/giver-contacts", async (req, res) => {
    const member = await authenticate(req);
    const item_id = idInput.parse(req.body?.item_id);
    const item = await db.item.findFirst({
      where: { id: item_id, owner_id: { not: member.id }, price_kobo: 0, status: "available" },
      include: { owner: { select: { phone: true } } },
    });
    if (!item?.owner.phone) throw new HttpError(404, "Giver contact is unavailable.");
    await db.itemRequest.createMany({
      data: {
        item_id,
        requester_user_id: member.id,
        name: member.full_name,
        phone: "",
        status: "contact_opened",
      },
      skipDuplicates: true,
    });
    res.json({ ok: true });
  });
  app.post("/api/orders/:id/handoff", async (req, res) => {
    const member = await authenticate(req);
    const id = idInput.parse(req.params["id"]);
    const { action } = z
      .object({ action: z.enum(["ready", "shipped", "received"]) })
      .parse(req.body);
    const where =
      action === "received"
        ? { buyer_id: member.id, handoff_status: { in: ["ready", "shipped"] } }
        : {
            seller_id: member.id,
            handoff_status: null,
            fulfillment_method: action === "ready" ? "pickup" : "delivery",
          };
    const updated = await db.order.updateMany({
      where: { id, status: "paid_direct", ...where },
      data: { handoff_status: action },
    });
    if (!updated.count)
      throw new HttpError(409, "This handoff update is unavailable. Refresh Order history.");
    res.json({ ok: true });
  });
  app.post("/api/orders/:id/deliver", async (req, res) => {
    const seller = await authenticate(req);
    const id = idInput.parse(req.params["id"]);
    const { note } = z.object({ note: z.string().trim().min(1).max(2000).optional() }).parse(req.body);
    const updated = await db.order.updateMany({
      where: { id, seller_id: seller.id, status: "paid" },
      data: { status: "delivery_pending", delivery_note: note ?? null },
    });
    if (!updated.count)
      throw new HttpError(409, "Only the seller can report delivery of a paid order.");
    res.json({ ok: true });
  });
  app.post("/api/orders/:id/confirm", async (req, res) => {
    const buyer = await authenticate(req);
    const updated = await db.order.updateMany({
      where: {
        id: idInput.parse(req.params["id"]),
        buyer_id: buyer.id,
        status: { in: ["paid", "delivery_pending", "delivered"] },
      },
      data: { status: "release_pending", release_at: new Date() },
    });
    if (!updated.count)
      throw new HttpError(409, "This order cannot be confirmed. Disputes require support review.");
    res.json({ ok: true });
  });
  app.post("/api/orders/:id/dispute", async (req, res) => {
    const buyer = await authenticate(req);
    const { reason } = z.object({ reason: z.string().trim().min(10).max(3000) }).parse(req.body);
    const updated = await db.order.updateMany({
      where: {
        id: idInput.parse(req.params["id"]),
        buyer_id: buyer.id,
        OR: [
          { status: { in: ["paid", "delivery_pending"] } },
          { status: "delivered", release_at: { gt: new Date() } },
        ],
      },
      data: { status: "disputed", dispute_reason: reason, release_at: null },
    });
    if (!updated.count)
      throw new HttpError(
        409,
        "This order is not eligible for a dispute here. Contact support if you need help.",
      );
    res.json({ ok: true });
  });
  app.post("/api/orders/:id/resolve", async (req, res) => {
    const admin = await authenticate(req);
    if (!isAdmin(admin.email)) throw new HttpError(403, "Administrator access required.");
    const { outcome, note } = z
      .object({ outcome: z.enum(["release", "refund"]), note: z.string().trim().min(10).max(3000) })
      .parse(req.body);
    if (outcome === "release") throw new HttpError(409, "A disputed payment cannot be released.");
    const updated = await db.order.updateMany({
      where: { id: idInput.parse(req.params["id"]), status: "disputed" },
      data: {
        status: "refund_pending",
        resolution_note: `Reviewer ${admin.id}: ${note}`,
        release_at: null,
      },
    });
    if (!updated.count) throw new HttpError(409, "Only disputed orders can be resolved.");
    res.json({ ok: true });
  });
  app.get("/api/orders/:id/messages", async (req, res) => {
    const { order } = await orderForParticipant(req, authenticate, req.params["id"]);
    const messages = await db.orderMessage.findMany({
      where: { order_id: order.id },
      orderBy: { created_at: "asc" },
      take: 200,
    });
    res.json(
      messages.map((message) => ({
        id: message.id,
        text: message.text,
        sender_id: message.sender_id,
        created_at: message.created_at,
      })),
    );
  });
  app.post("/api/orders/:id/messages", async (req, res) => {
    const { member, order } = await orderForParticipant(req, authenticate, req.params["id"]);
    const { text } = z.object({ text: z.string().trim().min(1).max(2000) }).parse(req.body);
    const message = await db.orderMessage.create({
      data: { order_id: order.id, sender_id: member.id, text },
    });
    res.status(201).json({
      id: message.id,
      text: message.text,
      sender_id: message.sender_id,
      created_at: message.created_at,
    });
  });
}

type Transfer = {
  status: string;
  amount: number;
  currency: string;
  reference: string;
  transfer_code: string;
  recipient: { recipient_code: string };
};
let withdrawalsWorking = false;
export async function processWalletWithdrawals(withdrawalIds?: string[]) {
  if (withdrawalsWorking || !marketplaceEnabled()) return;
  withdrawalsWorking = true;
  try {
    const withdrawals = await db.walletWithdrawal.findMany({
      where: {
        ...(withdrawalIds ? { id: { in: withdrawalIds } } : {}),
        status: { in: ["queued", "processing"] },
      },
      take: 20,
    });
    for (const withdrawal of withdrawals) {
      try {
        if (withdrawal.status === "queued") {
          const claimed = await db.walletWithdrawal.updateMany({
            where: { id: withdrawal.id, status: "queued" },
            data: { status: "processing" },
          });
          if (!claimed.count) continue;
        }
        let transfer: Transfer;
        try {
          transfer = await paystack<Transfer>(`/transfer/verify/${withdrawal.reference}`);
        } catch (error) {
          if (!(error instanceof PaystackError) || error.status !== 404) throw error;
          transfer = await paystack<Transfer>("/transfer", {
            source: "balance",
            amount: withdrawal.amount,
            recipient: withdrawal.recipient,
            reference: withdrawal.reference,
            reason: "DoingGood wallet withdrawal",
          });
        }
        const verified = await paystack<Transfer>(`/transfer/verify/${withdrawal.reference}`);
        if (
          verified.reference !== withdrawal.reference ||
          verified.amount !== withdrawal.amount ||
          verified.currency !== "NGN" ||
          verified.recipient.recipient_code !== withdrawal.recipient
        )
          throw new Error("Withdrawal transfer mismatch");
        if (verified.status === "success")
          await db.walletWithdrawal.updateMany({
            where: { id: withdrawal.id, status: "processing" },
            data: { status: "completed", transfer_code: transfer.transfer_code, completed_at: new Date() },
          });
        else if (["failed", "reversed", "abandoned"].includes(verified.status))
          await db.walletWithdrawal.updateMany({
            where: { id: withdrawal.id, status: "processing" },
            data: { status: "failed" },
          });
      } catch (error) {
        console.error("Wallet withdrawal awaiting reconciliation", {
          withdrawalId: withdrawal.id,
          providerStatus: error instanceof PaystackError ? error.status : undefined,
        });
        // An unknown network/provider outcome must stay reserved; retrying with a new request could pay twice.
        await db.walletWithdrawal.updateMany({
          where: { id: withdrawal.id, status: "processing" },
          data: { status: "review" },
        });
      }
    }
  } finally {
    withdrawalsWorking = false;
  }
}
let working = false;
export async function processCommerce(itemScope?: string[]) {
  if (working) return;
  working = true;
  try {
    if (!marketplaceEnabled()) return;
    const scope = {
      ...(itemScope ? { item_id: { in: itemScope } } : {}),
      recipient: { not: { startsWith: "ACCT_" } },
    };
    const expired = await db.order.findMany({
      where: {
        ...scope,
        status: "pending_payment",
        created_at: { lte: new Date(Date.now() - 30 * 60000) },
      },
      take: 20,
    });
    for (const o of expired)
      await db.$transaction(async (tx) => {
        const claim = await tx.order.updateMany({
          where: { id: o.id, status: "pending_payment" },
          data: { status: "payment_expired" },
        });
        if (claim.count)
          await tx.item.updateMany({
            where: { id: o.item_id, status: "reserved" },
            data: { status: "available", quantity: { increment: 1 } },
          });
      });
    // A restart or a sleeping server cannot lose deadlines: they are persisted in PostgreSQL.
    const notices = await db.order.findMany({
      where: { ...scope, status: "delivery_pending" },
      include: { buyer: true, item: true },
      take: 20,
    });
    for (const o of notices) {
      try {
        await sendEmail(
          o.buyer.email,
          `Please review delivery: ${o.item.title}`,
          `The giver reports delivery of ${o.item.title}.${o.delivery_note ? ` ${o.delivery_note}` : ""}\n\nOpen Order history at ${new URL("/orders", process.env["APP_URL"] || "http://localhost:5173")} to confirm receipt or dispute delivery. If you take no action within 24 hours of this notice, the payment becomes eligible for release. Only confirm once you have received and checked the item.`,
        );
        const now = new Date();
        await db.order.updateMany({
          where: { id: o.id, status: "delivery_pending" },
          data: {
            status: "delivered",
            delivered_at: now,
            notified_at: now,
            release_at: new Date(now.getTime() + REVIEW_MS),
          },
        });
      } catch {
        console.error("Delivery notice failed; release clock has not started.");
      }
    }
    await db.order.updateMany({
      where: { ...scope, status: "delivered", release_at: { lte: new Date() } },
      data: { status: "release_pending" },
    });
    const payouts = await db.order.findMany({
      where: { ...scope, status: { in: ["release_pending", "payout_processing"] } },
      take: 20,
    });
    for (const o of payouts) {
      try {
        if (o.recipient === "WALLET_PENDING") {
          await db.order.updateMany({
            where: { id: o.id, status: "release_pending" },
            data: { status: "released", release_at: new Date() },
          });
          continue;
        }
        // Claim before network I/O. Retries always reconcile/reuse the same provider reference.
        if (o.status === "release_pending") {
          const claimed = await db.order.updateMany({
            where: { id: o.id, status: "release_pending" },
            data: { status: "payout_processing" },
          });
          if (!claimed.count) continue;
        }
        let transfer: Transfer;
        try {
          transfer = await paystack<Transfer>(`/transfer/verify/${o.transfer_reference}`);
        } catch (error) {
          if (!(error instanceof PaystackError) || error.status !== 404) throw error;
          transfer = await paystack<Transfer>("/transfer", {
            source: "balance",
            amount: o.amount,
            recipient: o.recipient,
            reference: o.transfer_reference,
            reason: `DoingGood order ${o.id}`,
          });
        }
        // Initiation isn't success. Require a verified completed transfer with matching details.
        const verified = await paystack<Transfer>(`/transfer/verify/${o.transfer_reference}`);
        if (
          verified.reference !== o.transfer_reference ||
          verified.amount !== o.amount ||
          verified.currency !== "NGN" ||
          verified.recipient.recipient_code !== o.recipient
        )
          throw new Error("Transfer mismatch");
        if (verified.status === "success")
          await db.$transaction(async (tx) => {
            const changed = await tx.order.updateMany({
              where: { id: o.id, status: "payout_processing" },
              data: {
                status: "released",
                transfer_code: transfer.transfer_code,
                release_at: new Date(),
              },
            });
            if (changed.count)
              await tx.item.update({ where: { id: o.item_id }, data: { status: "sold" } });
          });
        else if (["failed", "reversed", "abandoned"].includes(verified.status))
          await db.order.updateMany({
            where: { id: o.id, status: "payout_processing" },
            data: { status: "payout_review" },
          });
      } catch {
        console.error("Payout awaiting reconciliation; no new reference will be used.");
      }
    }
    const refunds = await db.order.findMany({
      where: { ...scope, status: "refund_pending" },
      take: 20,
    });
    for (const o of refunds) {
      const claim = await db.order.updateMany({
        where: { id: o.id, status: "refund_pending" },
        data: { status: "refund_processing" },
      });
      if (!claim.count) continue;
      try {
        const refundAmount = Math.floor(o.amount * 0.99);
        const refund = await paystack<{ id: number }>("/refund", {
          transaction: o.reference,
          amount: refundAmount,
        });
        await db.order.update({ where: { id: o.id }, data: { refund_id: String(refund.id) } });
      } catch {
        // Refund creation has no documented idempotency key: never blindly resend after a timeout.
        await db.order.update({ where: { id: o.id }, data: { status: "refund_review" } });
      }
    }
    const reconciling = await db.order.findMany({
      where: { ...scope, status: "refund_processing", refund_id: { not: null } },
      take: 20,
    });
    for (const o of reconciling) {
      try {
        const refund = await paystack<{ status: string; amount: number; currency: string }>(
          `/refund/${o.refund_id}`,
        );
        if (
          refund.status === "processed" &&
          refund.amount === Math.floor(o.amount * 0.99) &&
          refund.currency === "NGN"
        )
          await db.$transaction(async (tx) => {
            const changed = await tx.order.updateMany({
              where: { id: o.id, status: "refund_processing" },
              data: { status: "refunded" },
            });
            if (!changed.count) return;
            const active = await tx.order.count({
              where: { item_id: o.item_id, status: { notIn: ["refunded", "payment_expired"] } },
            });
            await tx.item.updateMany({
              where: { id: o.item_id },
              data: { quantity: { increment: 1 }, ...(active ? {} : { status: "available" }) },
            });
          });
        else if (refund.status === "failed")
          await db.order.updateMany({
            where: { id: o.id, status: "refund_processing" },
            data: { status: "refund_review" },
          });
      } catch {
        console.error("Refund awaiting provider confirmation.");
      }
    }
  } finally {
    working = false;
  }
}
