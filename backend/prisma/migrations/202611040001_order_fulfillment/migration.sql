ALTER TABLE "Item"
    ADD COLUMN "pickup_available" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "delivery_fee_kobo" INTEGER,
    ADD COLUMN "delivery_area" TEXT;

ALTER TABLE "Order"
    ADD COLUMN "fulfillment_method" TEXT NOT NULL DEFAULT 'pickup',
    ADD COLUMN "delivery_fee_kobo" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "handoff_status" TEXT;
