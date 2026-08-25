CREATE TYPE "BotNotificationType" AS ENUM (
  'introLesson',
  'matchRequest',
  'matchAccepted',
  'matchContact',
  'dailyPlan',
  'weeklyCurator',
  'weeklyMatch'
);

ALTER TABLE "users" ADD COLUMN "time_zone" TEXT NOT NULL DEFAULT 'Asia/Almaty';

CREATE TABLE "bot_notifications" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "type" "BotNotificationType" NOT NULL,
  "dedupe_key" TEXT NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "scheduled_for" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimed_at" TIMESTAMP(3),
  "sent_at" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bot_notifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "bot_notifications_dedupe_key_key" ON "bot_notifications"("dedupe_key");
CREATE INDEX "bot_notifications_sent_at_scheduled_for_idx" ON "bot_notifications"("sent_at", "scheduled_for");
CREATE INDEX "bot_notifications_user_id_type_created_at_idx" ON "bot_notifications"("user_id", "type", "created_at");

ALTER TABLE "bot_notifications"
  ADD CONSTRAINT "bot_notifications_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "match_requests" ADD COLUMN "pair_key" TEXT;
UPDATE "match_requests"
SET "pair_key" = LEAST("sender_id", "receiver_id") || ':' || GREATEST("sender_id", "receiver_id");
ALTER TABLE "match_requests" ALTER COLUMN "pair_key" SET NOT NULL;
CREATE UNIQUE INDEX "match_requests_pair_key_key" ON "match_requests"("pair_key");
