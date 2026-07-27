-- Existing 30-day sessions cannot be upgraded safely to independent idle and
-- absolute deadlines. Preserve them as revoked audit rows and require one
-- reauthentication after deployment.
ALTER TABLE "auth_sessions"
RENAME COLUMN "expires_at" TO "absolute_expires_at";

ALTER TABLE "auth_sessions"
ADD COLUMN "authenticated_at" TIMESTAMP(3),
ADD COLUMN "last_activity_at" TIMESTAMP(3),
ADD COLUMN "idle_expires_at" TIMESTAMP(3),
ADD COLUMN "revoked_at" TIMESTAMP(3),
ADD COLUMN "revocation_reason" TEXT,
ADD COLUMN "updated_at" TIMESTAMP(3);

UPDATE "auth_sessions"
SET
  "authenticated_at" = "created_at",
  "last_activity_at" = "created_at",
  "idle_expires_at" = CURRENT_TIMESTAMP,
  "absolute_expires_at" = LEAST("absolute_expires_at", CURRENT_TIMESTAMP),
  "revoked_at" = CURRENT_TIMESTAMP,
  "revocation_reason" = 'LEGACY_MIGRATION',
  "updated_at" = CURRENT_TIMESTAMP;

ALTER TABLE "auth_sessions"
ALTER COLUMN "authenticated_at" SET NOT NULL,
ALTER COLUMN "last_activity_at" SET NOT NULL,
ALTER COLUMN "idle_expires_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

CREATE INDEX "auth_sessions_user_id_revoked_at_idx"
ON "auth_sessions"("user_id", "revoked_at");

CREATE INDEX "auth_sessions_idle_expires_at_idx"
ON "auth_sessions"("idle_expires_at");

CREATE INDEX "auth_sessions_absolute_expires_at_idx"
ON "auth_sessions"("absolute_expires_at");
