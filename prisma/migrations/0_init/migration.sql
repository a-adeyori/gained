-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('parent', 'student', 'tutor', 'admin');

-- CreateEnum
CREATE TYPE "EscrowState" AS ENUM ('held', 'base_paid', 'awaiting_retention', 'settled', 'returned', 'in_appeal');

-- CreateEnum
CREATE TYPE "QuizKind" AS ENUM ('baseline', 'post', 'retention');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "paypal_email" TEXT,
    "is_minor" BOOLEAN NOT NULL DEFAULT false,
    "parent_id" TEXT,
    "bio" TEXT,
    "subjects" TEXT[],
    "price_cents" INTEGER,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "tutor_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "payer_id" TEXT NOT NULL,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "price_cents" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "consent_recording" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'booked',
    "planned_topics" TEXT NOT NULL,
    "notes" TEXT,
    "transcript" TEXT,
    "topics_json" JSONB,
    "topics_confirmed_at" TIMESTAMP(3),
    "pipeline_error" TEXT,
    "paypal_order_id" TEXT,
    "tutor_confirmed_at" TIMESTAMP(3),
    "family_confirmed_at" TIMESTAMP(3),
    "is_seed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escrows" (
    "session_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "authorization_id" TEXT NOT NULL,
    "authorized_at" TIMESTAMP(3) NOT NULL,
    "reauthorized" BOOLEAN NOT NULL DEFAULT false,
    "state" "EscrowState" NOT NULL DEFAULT 'held',
    "base_capture_id" TEXT,
    "bonus_capture_id" TEXT,
    "base_payout_id" TEXT,
    "bonus_payout_id" TEXT,
    "returned_cents" INTEGER,

    CONSTRAINT "escrows_pkey" PRIMARY KEY ("session_id")
);

-- CreateTable
CREATE TABLE "quizzes" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "kind" "QuizKind" NOT NULL,
    "questions_json" JSONB NOT NULL,
    "sent_at" TIMESTAMP(3),
    "closes_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "responses_json" JSONB,
    "score" DOUBLE PRECISION,

    CONSTRAINT "quizzes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "answers" (
    "quiz_id" TEXT NOT NULL,
    "question_index" INTEGER NOT NULL,
    "answer" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "rationale" TEXT,

    CONSTRAINT "answers_pkey" PRIMARY KEY ("quiz_id","question_index")
);

-- CreateTable
CREATE TABLE "results" (
    "session_id" TEXT NOT NULL,
    "pre_score" DOUBLE PRECISION,
    "post_score" DOUBLE PRECISION,
    "retention_score" DOUBLE PRECISION,
    "gain_quiz" DOUBLE PRECISION,
    "gain_retention" DOUBLE PRECISION,
    "tutor_pay_cents" INTEGER,
    "rationale" TEXT,
    "override_tutor_pay_cents" INTEGER,

    CONSTRAINT "results_pkey" PRIMARY KEY ("session_id")
);

-- CreateTable
CREATE TABLE "appeals" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "opened_by" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolution" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "appeals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability" (
    "id" TEXT NOT NULL,
    "tutor_id" TEXT NOT NULL,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "availability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_paypal_order_id_key" ON "sessions"("paypal_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "quizzes_session_id_kind_key" ON "quizzes"("session_id", "kind");

-- CreateIndex
CREATE INDEX "availability_tutor_id_start_at_idx" ON "availability"("tutor_id", "start_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_payer_id_fkey" FOREIGN KEY ("payer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrows" ADD CONSTRAINT "escrows_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability" ADD CONSTRAINT "availability_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

