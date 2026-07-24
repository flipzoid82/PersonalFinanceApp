ALTER TABLE "accounts"
ADD COLUMN "notes" TEXT;

ALTER TABLE "manual_assets"
ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

DROP INDEX "manual_assets_user_id_asset_type_is_debt_idx";

CREATE INDEX "manual_assets_user_id_asset_type_is_debt_is_active_idx"
ON "manual_assets"("user_id", "asset_type", "is_debt", "is_active");
