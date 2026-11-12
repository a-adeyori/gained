-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "free_cancel_until" TIMESTAMP(3),
ADD COLUMN     "rescheduled_from" TIMESTAMP(3);
