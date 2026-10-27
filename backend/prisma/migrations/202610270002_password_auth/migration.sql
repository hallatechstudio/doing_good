ALTER TABLE "User" ADD COLUMN "password_hash" TEXT;

CREATE TABLE "PasswordReset" (
    "token_hash" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("token_hash")
);
CREATE UNIQUE INDEX "PasswordReset_user_id_key" ON "PasswordReset"("user_id");
CREATE INDEX "PasswordReset_expires_at_idx" ON "PasswordReset"("expires_at");
ALTER TABLE "PasswordReset" ADD CONSTRAINT "PasswordReset_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
