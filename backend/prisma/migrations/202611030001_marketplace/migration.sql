ALTER TABLE "User" ADD COLUMN "membership_until" TIMESTAMP(3), ADD COLUMN "payout_recipient" TEXT, ADD COLUMN "payout_name" TEXT;
ALTER TABLE "Item" ADD COLUMN "price_kobo" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Item" ADD CONSTRAINT "Item_price_nonnegative" CHECK ("price_kobo" >= 0 AND "price_kobo" <= 100000000);
CREATE TABLE "Purchase" (
  "id" UUID NOT NULL, "reference" TEXT NOT NULL, "user_id" UUID NOT NULL,
  "amount" INTEGER NOT NULL, "status" TEXT NOT NULL DEFAULT 'pending',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "paid_at" TIMESTAMP(3), "checkout_url" TEXT,
  CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Purchase_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Purchase_reference_key" ON "Purchase"("reference");
CREATE TABLE "Order" (
  "id" UUID NOT NULL, "reference" TEXT NOT NULL, "item_id" UUID NOT NULL,
  "buyer_id" UUID NOT NULL, "seller_id" UUID NOT NULL, "amount" INTEGER NOT NULL,
  "recipient" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'pending_payment', "checkout_url" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "paid_at" TIMESTAMP(3),
  "delivered_at" TIMESTAMP(3), "release_at" TIMESTAMP(3), "delivery_note" TEXT,
  "dispute_reason" TEXT, "resolution_note" TEXT, "transfer_reference" TEXT NOT NULL,
  "transfer_code" TEXT, "refund_id" TEXT, "notified_at" TIMESTAMP(3),
  CONSTRAINT "Order_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Order_amount_positive" CHECK ("amount" > 0),
  CONSTRAINT "Order_parties_different" CHECK ("buyer_id" <> "seller_id"),
  CONSTRAINT "Order_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Order_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Order_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Order_reference_key" ON "Order"("reference");
CREATE UNIQUE INDEX "Order_transfer_reference_key" ON "Order"("transfer_reference");
CREATE INDEX "Order_buyer_id_created_at_idx" ON "Order"("buyer_id", "created_at");
CREATE INDEX "Order_seller_id_created_at_idx" ON "Order"("seller_id", "created_at");
CREATE INDEX "Order_status_release_at_idx" ON "Order"("status", "release_at");
