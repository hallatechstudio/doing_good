# Marketplace payments

Free items are arranged with the giver on WhatsApp. Signed-in buyers and sellers can review
transactions in Order history. A verified sale immediately marks the listing as sold.

Sellers use **My listings → Add payments** to verify a Nigerian bank account and create a
payment recipient for a future payout. DoingGood adds no commission. A seller’s account is
only used after the payment-holding provider authorizes a release.

New checkout is disabled until a payment provider has approved the held-payment arrangement.
This prevents a buyer from being charged through a normal settlement flow that cannot keep the
funds pending for the delivery and dispute rules below. Paystack’s standard product cannot be
used as escrow for this arrangement.

For held orders, buyer confirmation authorizes release immediately. Otherwise, a delivery
notice starts a 24-hour dispute period. A dispute blocks release. The accountability window
starts when the provider confirms that payout completed.

For a public deployment, configure the provider webhook to the backend's `/api/payments/webhook`
endpoint only after the provider has approved the held-payment service.
The backend also verifies webhook signatures, provider mode, reference, buyer email,
currency and amount. A verified purchase updates Order history and removes the listing
from public availability. Legacy settlement records remain separate from live orders.

Run the commerce worker to expire abandoned reservations and reconcile late payments and refunds.
