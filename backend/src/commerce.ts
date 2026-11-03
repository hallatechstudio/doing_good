import type { Express, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "./db.js";
import { HttpError } from "./errors.js";
import { sendEmail } from "./email.js";
import {
  MEMBERSHIP_PRICE,
  REVIEW_MS,
  isMember,
  membershipExpiry,
  validSignature,
} from "./payment-rules.js";
import {
  checkout,
  marketplaceEnabled,
  paymentsEnabled,
  paystack,
  PaystackError,
  requirePayments,
  verifyPayment,
} from "./paystack.js";

type Identity = { id: string; email: string; full_name: string; membership_until: Date | null };
type Authenticate = (req: Request) => Promise<Identity>;
const idInput = z.string().uuid();
const referenceInput = z.string().regex(/^dg-(member|order)-[a-f0-9-]{36}$/);
export const isAdmin = (email: string) =>
  (process.env["COMMERCE_ADMIN_EMAILS"] || "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());

export async function recordPayment(reference: string) {
  const payment = await verifyPayment(reference);
  if (payment.status !== "success")
    throw new HttpError(409, "Payment is not confirmed yet. Try verifying again shortly.");
  const purchase = await db.purchase.findUnique({ where: { reference }, include: { user: true } });
  const order = purchase
    ? null
    : await db.order.findUnique({ where: { reference }, include: { buyer: true } });
  if (!purchase && !order) return;
  const amount = purchase?.amount ?? order!.amount;
  const email = purchase?.user.email ?? order!.buyer.email;
  if (
    payment.reference !== reference ||
    payment.amount !== amount ||
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
    await db.order.updateMany({
      where: { id: order.id, status: "pending_payment" },
      data: { status: "paid", paid_at: new Date() },
    });
    await db.order.updateMany({
      where: { id: order.id, status: "payment_expired" },
      data: { status: "refund_pending", paid_at: new Date() },
    });
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
  // Transfer and refund events are reconciled against the provider by the worker,
  // rather than trusting event ordering or treating a request as a completed payout.
  res.json({ ok: true });
}

export function mountCommerce(app: Express, authenticate: Authenticate) {
  app.get("/api/commerce", (_req, res) =>
    res.json({
      membership_price_kobo: MEMBERSHIP_PRICE,
      membership_days: 30,
      membership_checkout: paymentsEnabled(),
      protected_checkout: marketplaceEnabled(),
      membership_required: paymentsEnabled(),
    }),
  );
  app.post("/api/membership/checkout", async (req, res) => {
    const member = await authenticate(req);
    requirePayments();
    // Reuse an unconfirmed attempt; a retry never creates two memberships for one charge.
    let purchase = await db.purchase.findFirst({
      where: { user_id: member.id, status: "pending" },
      orderBy: { created_at: "desc" },
    });
    if (!purchase)
      purchase = await db.purchase.create({
        data: {
          user_id: member.id,
          reference: `dg-member-${randomUUID()}`,
          amount: MEMBERSHIP_PRICE,
        },
      });
    if (!purchase.checkout_url) {
      const session = await checkout(member.email, purchase.amount, purchase.reference);
      purchase = await db.purchase.update({
        where: { id: purchase.id },
        data: { checkout_url: session.authorization_url },
      });
    }
    res.json({ url: purchase.checkout_url, reference: purchase.reference });
  });
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
    const banks = await paystack<{ name: string; code: string }[]>(
      "/bank?country=nigeria&currency=NGN&perPage=100",
    );
    res.json(banks.map(({ name, code }) => ({ name, code })));
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
    const resolved = await paystack<{ account_name: string }>(
      `/bank/resolve?account_number=${input.account_number}&bank_code=${input.bank_code}`,
    );
    const recipient = await paystack<{ recipient_code: string }>("/transferrecipient", {
      type: "nuban",
      name: resolved.account_name,
      ...input,
      currency: "NGN",
    });
    // Store the provider token and verified name, never the full bank account number.
    await db.user.update({
      where: { id: member.id },
      data: { payout_recipient: recipient.recipient_code, payout_name: resolved.account_name },
    });
    res.json({ name: resolved.account_name });
  });
  app.post("/api/orders", async (req, res) => {
    const buyer = await authenticate(req);
    requirePayments(true);
    const { item_id } = z.object({ item_id: idInput }).parse(req.body);
    let order = await db.order.findFirst({
      where: { item_id, buyer_id: buyer.id, status: "pending_payment" },
    });
    if (!order)
      order = await db.$transaction(async (tx) => {
        const item = await tx.item.findUnique({ where: { id: item_id }, include: { owner: true } });
        if (!item || item.price_kobo <= 0) throw new HttpError(400, "Choose a paid item.");
        if (item.owner_id === buyer.id) throw new HttpError(400, "You cannot buy your own item.");
        if (!item.owner.payout_recipient)
          throw new HttpError(
            409,
            "The seller must add a payout account before this item can be purchased.",
          );
        const reserved = await tx.item.updateMany({
          where: { id: item_id, status: "available" },
          data: { status: "reserved" },
        });
        if (!reserved.count)
          throw new HttpError(409, "This item is already reserved or no longer available.");
        return tx.order.create({
          data: {
            item_id,
            buyer_id: buyer.id,
            seller_id: item.owner_id,
            amount: item.price_kobo,
            recipient: item.owner.payout_recipient,
            reference: `dg-order-${randomUUID()}`,
            transfer_reference: `dg-payout-${randomUUID()}`,
          },
        });
      });
    if (!order.checkout_url) {
      const session = await checkout(buyer.email, order.amount, order.reference);
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
      membership_until: member.membership_until,
      orders: orders.map((o) => ({
        id: o.id,
        item_id: o.item_id,
        title: o.item.title,
        photo: o.item.photos[0],
        amount: o.amount,
        buyer_id: o.buyer_id,
        seller_id: o.seller_id,
        status: o.status,
        reference: o.reference,
        created_at: o.created_at,
        release_at: o.release_at,
        delivery_note: o.delivery_note,
        dispute_reason: o.dispute_reason,
        resolution_note: o.resolution_note,
        buyer: o.buyer.full_name,
        seller: o.seller.full_name,
        contact: o.paid_at ? (member.id === o.seller_id ? o.buyer.phone : o.seller.phone) : "",
      })),
    });
  });
  app.post("/api/orders/:id/deliver", async (req, res) => {
    const seller = await authenticate(req);
    const id = idInput.parse(req.params["id"]);
    const { note } = z.object({ note: z.string().trim().min(10).max(2000) }).parse(req.body);
    const updated = await db.order.updateMany({
      where: { id, seller_id: seller.id, status: "paid" },
      data: { status: "delivery_pending", delivery_note: note },
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
    const updated = await db.order.updateMany({
      where: { id: idInput.parse(req.params["id"]), status: "disputed" },
      data: {
        status: outcome === "release" ? "release_pending" : "refund_pending",
        resolution_note: `Reviewer ${admin.id}: ${note}`,
        release_at: null,
      },
    });
    if (!updated.count) throw new HttpError(409, "Only disputed orders can be resolved.");
    res.json({ ok: true });
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
let working = false;
export async function processCommerce(itemScope?: string[]) {
  if (working) return;
  working = true;
  try {
    if (!marketplaceEnabled()) return;
    const scope = itemScope ? { item_id: { in: itemScope } } : {};
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
            data: { status: "available" },
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
          `The seller reports delivery of ${o.item.title}. ${o.delivery_note}\n\nYou have at least 24 hours from this notice to confirm receipt or open a dispute at ${process.env["APP_URL"]}/orders. If you do not dispute delivery, the payment becomes eligible for release. Do not confirm until you have received and checked the item.`,
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
              data: { status: "released", transfer_code: transfer.transfer_code },
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
        const refund = await paystack<{ id: number }>("/refund", {
          transaction: o.reference,
          amount: o.amount,
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
          refund.amount === o.amount &&
          refund.currency === "NGN"
        )
          await db.$transaction(async (tx) => {
            await tx.order.updateMany({
              where: { id: o.id, status: "refund_processing" },
              data: { status: "refunded" },
            });
            const active = await tx.order.count({
              where: { item_id: o.item_id, status: { notIn: ["refunded", "payment_expired"] } },
            });
            if (!active)
              await tx.item.updateMany({
                where: { id: o.item_id, status: "reserved" },
                data: { status: "pending" },
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

export { isMember };
