CREATE TABLE "WalletWithdrawal" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "amount" INTEGER NOT NULL,
  "recipient" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "transfer_code" TEXT,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "WalletWithdrawal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WalletWithdrawal_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "WalletWithdrawal_reference_key" ON "WalletWithdrawal"("reference");
CREATE INDEX "WalletWithdrawal_user_id_status_created_at_idx" ON "WalletWithdrawal"("user_id", "status", "created_at");
CREATE INDEX "WalletWithdrawal_status_created_at_idx" ON "WalletWithdrawal"("status", "created_at");
