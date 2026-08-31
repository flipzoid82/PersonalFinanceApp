CREATE TYPE "ImportCandidateKind" AS ENUM ('BALANCE_SNAPSHOT', 'INVESTMENT_BALANCE_SNAPSHOT', 'HOLDING', 'INVESTMENT_TRANSACTION', 'INFORMATIONAL');
CREATE TYPE "ImportCandidateStatus" AS ENUM ('READY', 'DUPLICATE', 'NEEDS_REVIEW', 'REJECTED', 'INFORMATIONAL', 'SKIPPED');
CREATE TYPE "ImportAccountMatchStatus" AS ENUM ('MATCHED', 'NEEDS_REVIEW', 'CREATE');
CREATE TYPE "ImportSourceStatus" AS ENUM ('RETAINED', 'DELETED', 'MISSING', 'FAILED');

ALTER TYPE "ImportStatus" ADD VALUE 'NEEDS_REVIEW';
ALTER TYPE "ImportStatus" ADD VALUE 'READY';
ALTER TYPE "ImportStatus" ADD VALUE 'CANCELED';
ALTER TYPE "ImportStatus" ADD VALUE 'REVERTED';

ALTER TYPE "ImportType" ADD VALUE 'GENERIC_INVESTMENT_HOLDINGS_CSV';
ALTER TYPE "ImportType" ADD VALUE 'FIDELITY_NETBENEFITS_STATEMENT';
ALTER TYPE "ImportType" ADD VALUE 'FIDELITY_BROKERAGE_STATEMENT';
ALTER TYPE "ImportType" ADD VALUE 'FIDELITY_TRADE_CONFIRMATION';
ALTER TYPE "ImportType" ADD VALUE 'TSP_STATEMENT';

ALTER TABLE "accounts" ADD COLUMN "created_by_import_job_id" TEXT;
ALTER TABLE "balance_snapshots" ADD COLUMN "import_identity_key" VARCHAR(64), ADD COLUMN "import_job_id" TEXT;
ALTER TABLE "investment_balance_snapshots" ADD COLUMN "import_identity_key" VARCHAR(64), ADD COLUMN "import_job_id" TEXT;
ALTER TABLE "investment_holdings" ADD COLUMN "import_identity_key" VARCHAR(64), ADD COLUMN "import_job_id" TEXT;
ALTER TABLE "investment_transactions" ADD COLUMN "import_identity_key" VARCHAR(64), ADD COLUMN "import_job_id" TEXT;

ALTER TABLE "import_jobs"
  ADD COLUMN "as_of_date" TIMESTAMP(3),
  ADD COLUMN "currency" CHAR(3),
  ADD COLUMN "duplicate_row_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "failure_code" TEXT,
  ADD COLUMN "file_fingerprint" CHAR(64),
  ADD COLUMN "informational_row_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "matched_account_id" TEXT,
  ADD COLUMN "parser_family" TEXT,
  ADD COLUMN "parser_version" TEXT,
  ADD COLUMN "plan_data" JSONB,
  ADD COLUMN "plan_fingerprint" CHAR(64),
  ADD COLUMN "plan_version" INTEGER,
  ADD COLUMN "reverted_at" TIMESTAMP(3),
  ADD COLUMN "review_row_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "source_content_type" TEXT,
  ADD COLUMN "source_deleted_at" TIMESTAMP(3),
  ADD COLUMN "source_retain_until" TIMESTAMP(3),
  ADD COLUMN "source_size" INTEGER,
  ADD COLUMN "source_status" "ImportSourceStatus",
  ADD COLUMN "source_storage_key" VARCHAR(80),
  ADD COLUMN "statement_end_at" DATE,
  ADD COLUMN "statement_start_at" DATE,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "import_account_matches" (
  "id" TEXT NOT NULL,
  "import_job_id" TEXT NOT NULL,
  "source_key" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "institution_name" TEXT,
  "masked_identifier" TEXT,
  "account_type" "AccountType" NOT NULL,
  "account_subtype" TEXT,
  "currency" CHAR(3) NOT NULL,
  "status" "ImportAccountMatchStatus" NOT NULL,
  "matched_account_id" TEXT,
  "reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "import_account_matches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "import_candidates" (
  "id" TEXT NOT NULL,
  "import_job_id" TEXT NOT NULL,
  "account_match_id" TEXT,
  "ordinal" INTEGER NOT NULL,
  "kind" "ImportCandidateKind" NOT NULL,
  "status" "ImportCandidateStatus" NOT NULL,
  "source_fingerprint" CHAR(64) NOT NULL,
  "source_label" TEXT,
  "proposed_data" JSONB,
  "evidence" JSONB NOT NULL,
  "review_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "import_candidates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "import_account_matches_matched_account_id_idx" ON "import_account_matches"("matched_account_id");
CREATE UNIQUE INDEX "import_account_matches_import_job_id_source_key_key" ON "import_account_matches"("import_job_id", "source_key");
CREATE INDEX "import_candidates_import_job_id_status_ordinal_idx" ON "import_candidates"("import_job_id", "status", "ordinal");
CREATE INDEX "import_candidates_account_match_id_idx" ON "import_candidates"("account_match_id");
CREATE UNIQUE INDEX "import_candidates_import_job_id_source_fingerprint_key" ON "import_candidates"("import_job_id", "source_fingerprint");
CREATE INDEX "accounts_created_by_import_job_id_idx" ON "accounts"("created_by_import_job_id");
CREATE INDEX "balance_snapshots_import_job_id_idx" ON "balance_snapshots"("import_job_id");
CREATE UNIQUE INDEX "balance_snapshots_user_id_import_identity_key_key" ON "balance_snapshots"("user_id", "import_identity_key");
CREATE INDEX "import_jobs_user_id_file_fingerprint_idx" ON "import_jobs"("user_id", "file_fingerprint");
CREATE INDEX "import_jobs_source_status_source_retain_until_idx" ON "import_jobs"("source_status", "source_retain_until");
CREATE INDEX "investment_balance_snapshots_import_job_id_idx" ON "investment_balance_snapshots"("import_job_id");
CREATE UNIQUE INDEX "investment_balance_snapshots_user_id_import_identity_key_key" ON "investment_balance_snapshots"("user_id", "import_identity_key");
CREATE INDEX "investment_holdings_import_job_id_idx" ON "investment_holdings"("import_job_id");
CREATE UNIQUE INDEX "investment_holdings_user_id_import_identity_key_key" ON "investment_holdings"("user_id", "import_identity_key");
CREATE INDEX "investment_transactions_import_job_id_idx" ON "investment_transactions"("import_job_id");
CREATE UNIQUE INDEX "investment_transactions_user_id_import_identity_key_key" ON "investment_transactions"("user_id", "import_identity_key");

ALTER TABLE "accounts" ADD CONSTRAINT "accounts_created_by_import_job_id_fkey" FOREIGN KEY ("created_by_import_job_id") REFERENCES "import_jobs"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "investment_holdings" ADD CONSTRAINT "investment_holdings_import_job_id_fkey" FOREIGN KEY ("import_job_id") REFERENCES "import_jobs"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "investment_balance_snapshots" ADD CONSTRAINT "investment_balance_snapshots_import_job_id_fkey" FOREIGN KEY ("import_job_id") REFERENCES "import_jobs"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "investment_transactions" ADD CONSTRAINT "investment_transactions_import_job_id_fkey" FOREIGN KEY ("import_job_id") REFERENCES "import_jobs"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "balance_snapshots" ADD CONSTRAINT "balance_snapshots_import_job_id_fkey" FOREIGN KEY ("import_job_id") REFERENCES "import_jobs"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_matched_account_id_fkey" FOREIGN KEY ("matched_account_id") REFERENCES "accounts"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "import_account_matches" ADD CONSTRAINT "import_account_matches_import_job_id_fkey" FOREIGN KEY ("import_job_id") REFERENCES "import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "import_account_matches" ADD CONSTRAINT "import_account_matches_matched_account_id_fkey" FOREIGN KEY ("matched_account_id") REFERENCES "accounts"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "import_candidates" ADD CONSTRAINT "import_candidates_import_job_id_fkey" FOREIGN KEY ("import_job_id") REFERENCES "import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "import_candidates" ADD CONSTRAINT "import_candidates_account_match_id_fkey" FOREIGN KEY ("account_match_id") REFERENCES "import_account_matches"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
