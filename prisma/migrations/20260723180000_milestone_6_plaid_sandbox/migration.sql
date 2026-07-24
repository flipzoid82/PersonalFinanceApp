ALTER TABLE "institution_connections"
ADD COLUMN "link_session_id" TEXT,
ADD COLUMN "sync_cursor" TEXT,
ADD COLUMN "sync_started_at" TIMESTAMP(3),
ADD COLUMN "last_attempted_sync_at" TIMESTAMP(3),
ADD COLUMN "last_error_code" TEXT,
ADD COLUMN "last_error_message" TEXT,
ADD COLUMN "disconnected_at" TIMESTAMP(3);

ALTER TABLE "accounts"
ADD COLUMN "mask" TEXT,
ADD COLUMN "balance_available" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "transactions"
ADD COLUMN "removed_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "institution_connections_link_session_id_key"
ON "institution_connections"("link_session_id");

CREATE INDEX "institution_connections_user_id_status_idx"
ON "institution_connections"("user_id", "status");

CREATE INDEX "institution_connections_sync_started_at_idx"
ON "institution_connections"("sync_started_at");
