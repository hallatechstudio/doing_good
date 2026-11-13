CREATE TABLE "OrderMessage" (
  "id" UUID NOT NULL, "order_id" UUID NOT NULL, "sender_id" UUID NOT NULL,
  "text" TEXT NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderMessage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrderMessage_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OrderMessage_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "OrderMessage_order_id_created_at_idx" ON "OrderMessage"("order_id", "created_at");
