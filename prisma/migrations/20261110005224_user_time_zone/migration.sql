-- AlterTable
ALTER TABLE "users" ADD COLUMN     "time_zone" TEXT,
ADD COLUMN     "time_zone_manual" BOOLEAN NOT NULL DEFAULT false;
