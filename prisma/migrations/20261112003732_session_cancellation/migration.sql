-- AlterEnum
ALTER TYPE "EscrowState" ADD VALUE 'cancelled';

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "cancel_reason" TEXT,
ADD COLUMN     "cancelled_at" TIMESTAMP(3),
ADD COLUMN     "cancelled_by_id" TEXT;
