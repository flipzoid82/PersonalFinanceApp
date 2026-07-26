ALTER TABLE "accounts"
ADD COLUMN "provider_identity_key" VARCHAR(80);

CREATE UNIQUE INDEX "accounts_user_id_provider_identity_key_key"
ON "accounts"("user_id", "provider_identity_key");

CREATE TABLE "provider_account_links" (
    "user_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "logical_identity_key" VARCHAR(80),
    "account_id" TEXT NOT NULL,
    "institution_connection_id" TEXT NOT NULL,
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_account_links_pkey"
        PRIMARY KEY ("user_id", "provider", "provider_account_id")
);

CREATE UNIQUE INDEX "provider_account_links_institution_connection_id_account_id_key"
ON "provider_account_links"("institution_connection_id", "account_id");

CREATE INDEX "provider_account_links_account_id_idx"
ON "provider_account_links"("account_id");

CREATE INDEX "provider_account_links_institution_connection_id_is_current_idx"
ON "provider_account_links"("institution_connection_id", "is_current");

CREATE INDEX "provider_account_links_user_id_logical_identity_key_idx"
ON "provider_account_links"("user_id", "logical_identity_key");

CREATE UNIQUE INDEX "provider_account_links_one_current_per_account"
ON "provider_account_links"("account_id")
WHERE "is_current" = true;

CREATE TABLE "account_merge_audits" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "canonical_account_id" TEXT NOT NULL,
    "duplicate_account_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "merged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_merge_audits_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "account_merge_audits_duplicate_account_id_key"
ON "account_merge_audits"("duplicate_account_id");

CREATE INDEX "account_merge_audits_user_id_canonical_account_id_idx"
ON "account_merge_audits"("user_id", "canonical_account_id");

ALTER TABLE "provider_account_links"
ADD CONSTRAINT "provider_account_links_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "provider_account_links"
ADD CONSTRAINT "provider_account_links_account_id_fkey"
FOREIGN KEY ("account_id") REFERENCES "accounts"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "provider_account_links"
ADD CONSTRAINT "provider_account_links_institution_connection_id_fkey"
FOREIGN KEY ("institution_connection_id") REFERENCES "institution_connections"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "account_merge_audits"
ADD CONSTRAINT "account_merge_audits_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
