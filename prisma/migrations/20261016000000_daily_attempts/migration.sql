-- CreateTable
CREATE TABLE "daily_attempts" (
    "user_id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "picks" INTEGER[],
    "solved_at" TIMESTAMP(3),

    CONSTRAINT "daily_attempts_pkey" PRIMARY KEY ("user_id","day")
);

-- AddForeignKey
ALTER TABLE "daily_attempts" ADD CONSTRAINT "daily_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
