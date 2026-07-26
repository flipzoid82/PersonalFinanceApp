-- Nullable keys preserve every manual and historical row while giving inferred
-- records deterministic, owner-scoped identities for concurrent upserts.
ALTER TABLE "recurring_streams"
ADD COLUMN "detection_key" TEXT,
ADD COLUMN "detection_version" INTEGER,
ADD COLUMN "detection_metadata" JSONB,
ADD COLUMN "last_detected_at" TIMESTAMP(3);

ALTER TABLE "calendar_events"
ADD COLUMN "projection_key" TEXT;

CREATE UNIQUE INDEX "recurring_streams_user_id_detection_key_key"
ON "recurring_streams"("user_id", "detection_key");

CREATE UNIQUE INDEX "calendar_events_user_id_projection_key_key"
ON "calendar_events"("user_id", "projection_key");

CREATE UNIQUE INDEX "calendar_events_user_id_linked_transaction_id_key"
ON "calendar_events"("user_id", "linked_transaction_id");
