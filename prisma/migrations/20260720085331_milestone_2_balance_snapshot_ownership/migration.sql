-- Add the ownership column without a default, backfill it from the owning account,
-- and only then make it required so existing Milestone 1/2 databases migrate safely.
ALTER TABLE "balance_snapshots" ADD COLUMN "user_id" TEXT;

UPDATE "balance_snapshots" AS snapshot
SET "user_id" = account."user_id"
FROM "accounts" AS account
WHERE snapshot."account_id" = account."id";

ALTER TABLE "balance_snapshots" ALTER COLUMN "user_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "balance_snapshots_user_id_idx" ON "balance_snapshots"("user_id");

-- AddForeignKey
ALTER TABLE "balance_snapshots" ADD CONSTRAINT "balance_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
