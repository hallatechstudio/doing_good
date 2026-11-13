UPDATE "Item" AS item
SET "status" = 'sold'
WHERE item."status" IN ('given', 'reserved')
  AND EXISTS (
    SELECT 1
    FROM "Order" AS purchase
    WHERE purchase."item_id" = item."id"
      AND purchase."paid_at" IS NOT NULL
      AND purchase."status" IN (
        'paid_direct', 'paid', 'delivery_pending', 'delivered', 'disputed',
        'release_pending', 'payout_processing', 'payout_review', 'released'
      )
  );
