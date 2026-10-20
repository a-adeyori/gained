-- AlterTable
ALTER TABLE "users" ADD COLUMN     "email_verified_at" TIMESTAMP(3);

-- Accounts that already sign in predate verification; treat them as verified.
UPDATE "users" SET "email_verified_at" = CURRENT_TIMESTAMP WHERE "password_hash" IS NOT NULL;
