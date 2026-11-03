# Free listings, paid orders and membership

## Current rollout

Existing listings migrate to `price_kobo = 0`. A seller can choose a free item or set a price
from NGN 100 to NGN 1,000,000. Prices and all payments use integer kobo, currency NGN.
No platform commission is currently deducted. Payment-provider and transfer fees must be
covered by the operator's balance; they are not silently removed from seller payouts.

Membership is NGN 20,000 for **30 days**, renewed by a deliberate new checkout, not recurring
billing. It gates contact details for free listings when membership payments are enabled.
Browsing and listing do not require membership. Membership gives access to request, not a
guaranteed item or delivery. Renewing early extends the existing expiry. Payment callbacks
and webhooks are verified server-side, and replay cannot grant the same purchase twice.

Payment features default to **off**. While they are off, signed-in users keep the existing
free-item contact flow. Paid listings can be created and browsed, but cannot be purchased.
The homepage explains that membership checkout is coming soon. Do not switch the membership
gate on until the price/terms have been communicated to existing users.

## Required payment decision

Paystack's published policy lists escrow services as ineligible:
https://support.paystack.com/en/articles/2127042

Standard Paystack collections and transfers do **not** by themselves implement approved
escrow. The paid-order implementation is a gated collection/release workflow, not a claim
that Paystack safeguards funds for buyers. Do not enable it with ordinary merchant keys.
The current adapter is hard-locked to Paystack test keys for paid-order checkout and payout
processing, even if a flag is mistakenly enabled with a live key. An approved marketplace/escrow
provider and corresponding payment adapter are required for real paid orders. Keep
`PAYSTACK_HOLDING_APPROVED=false` outside an explicitly configured sandbox test. This flag is
not proof of provider approval and cannot enable live escrow.
Paystack membership payments can be enabled separately from paid-order checkout.

## Backend environment

Add these to the ignored backend `.env` locally and Render secrets in production:

```
PAYSTACK_SECRET_KEY=
PAYMENTS_ENABLED=false
PAYSTACK_HOLDING_APPROVED=false
COMMERCE_ADMIN_EMAILS=
```

Use test keys for test-mode checkout first. Never put a secret key in Vite/frontend env.
`PAYMENTS_ENABLED=true` plus a key enables membership payment and its access gate.
Sandbox paid-item checkout and payouts additionally require `PAYSTACK_HOLDING_APPROVED=true`,
a test key and at least one configured admin. Live paid checkout remains unavailable.
`COMMERCE_ADMIN_EMAILS` is a comma-separated list of existing signed-in account emails whose
owners may view orders and resolve disputes. Do not give seller accounts this role.

Configure the Paystack webhook as:
`https://doing-good.onrender.com/api/payments/webhook`

The route receives raw bytes, verifies the SHA-512 HMAC, then independently verifies a
successful charge's reference, amount, NGN currency and buyer email before recording it.
Browser redirects alone never prove a payment succeeded. Checkout returns to `/orders`.
Only the payment owner can invoke browser verification. Webhooks are retry-safe.

`APP_URL` must be the actual frontend origin. Postmark must have a verified sender, valid
server token and transactional message stream. Delivery notices use the existing Postmark
configuration. Missing/failed email delivery does not silently start a release deadline.

## Order flow

1. Seller adds a payout account in **Orders & membership**. The API resolves the bank
   account name and creates a recipient token. It stores the token and name, not the full
   account number. Existing order recipients are immutable if the seller changes accounts.
2. Buyer checks out a paid item. The backend snapshots the price and reserves inventory
   atomically. Only one buyer can reserve it. The seller cannot override an ordered item's
   status in the listings dashboard. Unpaid orders reserve for 30 minutes; the worker then
   expires the reservation. A charge arriving after expiry is queued for a full refund,
   never attached to a different buyer's order.
3. A verified successful charge records `paid`. No transfer occurs at checkout.
4. Buyer and seller arrange collection/delivery. Sellers provide delivery details in Orders.
   Once the buyer's review email is successfully submitted, status becomes `delivered` and
   the server records a 24-hour UTC deadline. A successful email API response is submission,
   not a guarantee of inbox delivery; monitor Postmark bounces and support requests.
5. Buyer explicitly confirms receipt to queue payout immediately, or disputes within the
   window to freeze it. An undisputed deadline queues payout automatically. Buyer disputes
   and the release worker use conditional database updates; they cannot both win.
6. A disputed order has no release timer. An admin reviews evidence from both parties,
   records findings and chooses **pay seller** or **refund buyer** in Orders. This is a human
   decision; the system does not infer delivery from WhatsApp messages.
7. Payouts use one immutable transfer reference per order. Provider initiation is not payout
   success: the worker reconciles the transfer and checks reference, recipient, amount and
   currency. Only a confirmed successful transfer marks the order released/item sold.
8. Refund initiation is claimed once. Because refund creation has no documented idempotency
   key, an ambiguous timeout is moved to support review rather than blindly sending again.
   A verified processed refund marks `refunded`; an ordinary refunded listing goes on hold
   for its seller to review/relist. Late-payment refunds cannot free another buyer's reservation.

Keep an operational support process for `payout_review`, `refund_review`, refunds without
a recorded provider ID after a crash, and transactions requiring provider-side approval.
Reconcile in the provider dashboard before any manual money movement; never create a new
payout reference merely to retry an unknown transfer. Membership refund requests are reviewed
through support/provider dashboard; support must also adjust membership access if refunded.

## Worker and deployment

Build: `npm ci --include=dev && npm run build && npm run db:migrate`

The web service runs a worker every minute, with timestamps and states persisted in Postgres.
For reliable unattended deadlines use an always-on Render service, or a scheduled job in the
backend directory running `npm run commerce:run` every minute after a build. A sleeping free
web service processes overdue work when it wakes; it does not guarantee a payout exactly at
the 24-hour boundary. No Docker is needed. Keep the worker and API on the same database/env.

This migration is additive and retains existing users and listings. Deploy the backend first,
verify `/api/commerce`, then deploy the Vercel frontend. Keep the existing `/api` Vercel rewrite.
Enable membership only after a test payment, webhook replay, account expiry and refund procedure
have been checked. Paid-item checkout additionally requires the provider decision above.

## Checks

`npm run typecheck`, `npm run build`, `npm test` in each application. Backend integration
tests use uniquely named temporary PostgreSQL records and mock every payment/email call.
They clean up their records and scope the worker to test items, so running tests cannot
process real marketplace orders or send a real payment. No live gateway transaction has
been exercised without credentials and an approved marketplace arrangement.
