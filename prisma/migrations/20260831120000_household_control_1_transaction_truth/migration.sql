-- Household Control 1 expands immutable transactions with owner-scoped,
-- auditable interpretation. Existing override fields remain for compatible
-- read-through and bounded backfill.
ALTER TYPE "FinancialRole" ADD VALUE 'BORROWING_PROCEEDS';

CREATE TYPE "TransactionCategoryKind" AS ENUM ('EXPENSE', 'INCOME');
CREATE TYPE "EconomicDirection" AS ENUM ('INFLOW', 'OUTFLOW', 'UNKNOWN');
CREATE TYPE "ClassificationProvenance" AS ENUM ('OWNER_OVERRIDE', 'OWNER_RULE', 'SYSTEM', 'PROVIDER', 'UNRESOLVED');
CREATE TYPE "ClassificationCertainty" AS ENUM ('CONFIRMED', 'DETERMINISTIC', 'PROVIDER_ONLY', 'CONFLICTING', 'UNKNOWN');
CREATE TYPE "ClassificationReviewState" AS ENUM ('RESOLVED', 'NEEDS_REVIEW', 'DEFERRED');
CREATE TYPE "ClassificationRuleMatchType" AS ENUM ('MERCHANT_EXACT', 'DESCRIPTION_EXACT', 'DESCRIPTION_PREFIX', 'DESCRIPTION_CONTAINS', 'MERCHANT_ACCOUNT');
CREATE TYPE "TransactionRelationshipType" AS ENUM ('INTERNAL_TRANSFER', 'CREDIT_CARD_PAYMENT', 'REFUND', 'REIMBURSEMENT');
CREATE TYPE "TransactionRelationshipState" AS ENUM ('SUGGESTED', 'CONFIRMED', 'REJECTED', 'NEEDS_REVIEW');

ALTER TABLE "users"
  ADD COLUMN "transaction_truth_cutover_at" TIMESTAMP(3),
  ADD COLUMN "transaction_truth_version" INTEGER;

CREATE TABLE "transaction_categories" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "system_key" TEXT,
  "kind" "TransactionCategoryKind" NOT NULL,
  "name" TEXT NOT NULL,
  "normalized_name" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "display_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "transaction_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "transaction_classifications" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "transaction_id" TEXT NOT NULL,
  "financial_role" "FinancialRole",
  "transaction_category_id" TEXT,
  "economic_direction" "EconomicDirection" NOT NULL DEFAULT 'UNKNOWN',
  "role_provenance" "ClassificationProvenance" NOT NULL DEFAULT 'UNRESOLVED',
  "category_provenance" "ClassificationProvenance" NOT NULL DEFAULT 'UNRESOLVED',
  "direction_provenance" "ClassificationProvenance" NOT NULL DEFAULT 'UNRESOLVED',
  "role_certainty" "ClassificationCertainty" NOT NULL DEFAULT 'UNKNOWN',
  "category_certainty" "ClassificationCertainty" NOT NULL DEFAULT 'UNKNOWN',
  "direction_certainty" "ClassificationCertainty" NOT NULL DEFAULT 'UNKNOWN',
  "review_state" "ClassificationReviewState" NOT NULL DEFAULT 'NEEDS_REVIEW',
  "reason_codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "classifier_version" INTEGER NOT NULL,
  "evidence" JSONB,
  "deferred_until" TIMESTAMP(3),
  "classified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "transaction_classifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "classification_rules" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "match_type" "ClassificationRuleMatchType" NOT NULL,
  "normalized_value" TEXT NOT NULL,
  "account_id" TEXT,
  "transaction_category_id" TEXT,
  "financial_role" "FinancialRole",
  "economic_direction" "EconomicDirection",
  "priority" INTEGER NOT NULL DEFAULT 100,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "applies_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rule_version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "classification_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "transaction_allocations" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "transaction_id" TEXT NOT NULL,
  "transaction_category_id" TEXT NOT NULL,
  "amount" DECIMAL(19,4) NOT NULL,
  "display_order" INTEGER NOT NULL DEFAULT 0,
  "provenance" "ClassificationProvenance" NOT NULL DEFAULT 'OWNER_OVERRIDE',
  "reviewed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "transaction_allocations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "transaction_allocations_positive_amount" CHECK ("amount" > 0)
);

CREATE TABLE "transaction_relationships" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "source_transaction_id" TEXT NOT NULL,
  "target_transaction_id" TEXT NOT NULL,
  "type" "TransactionRelationshipType" NOT NULL,
  "applied_amount" DECIMAL(19,4),
  "provenance" "ClassificationProvenance" NOT NULL DEFAULT 'SYSTEM',
  "certainty" "ClassificationCertainty" NOT NULL DEFAULT 'UNKNOWN',
  "state" "TransactionRelationshipState" NOT NULL DEFAULT 'SUGGESTED',
  "reason_codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "evidence" JSONB,
  "confirmed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "transaction_relationships_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "transaction_relationships_distinct_endpoints" CHECK ("source_transaction_id" <> "target_transaction_id"),
  CONSTRAINT "transaction_relationships_positive_applied_amount" CHECK ("applied_amount" IS NULL OR "applied_amount" > 0)
);

ALTER TABLE "transaction_overrides"
  ADD COLUMN "transaction_category_id" TEXT,
  ADD COLUMN "economic_direction_override" "EconomicDirection",
  ADD COLUMN "reviewed_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "transaction_categories_user_id_system_key_key" ON "transaction_categories"("user_id", "system_key");
CREATE UNIQUE INDEX "transaction_categories_user_id_normalized_name_key" ON "transaction_categories"("user_id", "normalized_name");
CREATE INDEX "transaction_categories_user_id_kind_is_active_display_order_idx" ON "transaction_categories"("user_id", "kind", "is_active", "display_order");
CREATE UNIQUE INDEX "transaction_classifications_transaction_id_key" ON "transaction_classifications"("transaction_id");
CREATE INDEX "transaction_classifications_user_id_review_state_deferred_until_idx" ON "transaction_classifications"("user_id", "review_state", "deferred_until");
CREATE INDEX "transaction_classifications_user_id_financial_role_idx" ON "transaction_classifications"("user_id", "financial_role");
CREATE INDEX "transaction_classifications_user_id_transaction_category_id_idx" ON "transaction_classifications"("user_id", "transaction_category_id");
CREATE INDEX "transaction_classifications_user_id_economic_direction_idx" ON "transaction_classifications"("user_id", "economic_direction");
CREATE INDEX "classification_rules_user_id_is_active_priority_idx" ON "classification_rules"("user_id", "is_active", "priority");
CREATE INDEX "classification_rules_user_id_match_type_normalized_value_idx" ON "classification_rules"("user_id", "match_type", "normalized_value");
CREATE INDEX "classification_rules_account_id_idx" ON "classification_rules"("account_id");
CREATE UNIQUE INDEX "transaction_allocations_transaction_id_transaction_category_id_key" ON "transaction_allocations"("transaction_id", "transaction_category_id");
CREATE UNIQUE INDEX "transaction_allocations_transaction_id_display_order_key" ON "transaction_allocations"("transaction_id", "display_order");
CREATE INDEX "transaction_allocations_user_id_transaction_category_id_idx" ON "transaction_allocations"("user_id", "transaction_category_id");
CREATE UNIQUE INDEX "transaction_relationships_user_id_type_source_transaction_id_target_transaction_id_key" ON "transaction_relationships"("user_id", "type", "source_transaction_id", "target_transaction_id");
CREATE INDEX "transaction_relationships_user_id_state_type_idx" ON "transaction_relationships"("user_id", "state", "type");
CREATE INDEX "transaction_relationships_source_transaction_id_idx" ON "transaction_relationships"("source_transaction_id");
CREATE INDEX "transaction_relationships_target_transaction_id_idx" ON "transaction_relationships"("target_transaction_id");
CREATE INDEX "transaction_overrides_transaction_category_id_idx" ON "transaction_overrides"("transaction_category_id");

ALTER TABLE "transaction_categories" ADD CONSTRAINT "transaction_categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transaction_classifications" ADD CONSTRAINT "transaction_classifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transaction_classifications" ADD CONSTRAINT "transaction_classifications_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transaction_classifications" ADD CONSTRAINT "transaction_classifications_transaction_category_id_fkey" FOREIGN KEY ("transaction_category_id") REFERENCES "transaction_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "classification_rules" ADD CONSTRAINT "classification_rules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "classification_rules" ADD CONSTRAINT "classification_rules_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "classification_rules" ADD CONSTRAINT "classification_rules_transaction_category_id_fkey" FOREIGN KEY ("transaction_category_id") REFERENCES "transaction_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "transaction_allocations" ADD CONSTRAINT "transaction_allocations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transaction_allocations" ADD CONSTRAINT "transaction_allocations_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transaction_allocations" ADD CONSTRAINT "transaction_allocations_transaction_category_id_fkey" FOREIGN KEY ("transaction_category_id") REFERENCES "transaction_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transaction_relationships" ADD CONSTRAINT "transaction_relationships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transaction_relationships" ADD CONSTRAINT "transaction_relationships_source_transaction_id_fkey" FOREIGN KEY ("source_transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transaction_relationships" ADD CONSTRAINT "transaction_relationships_target_transaction_id_fkey" FOREIGN KEY ("target_transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transaction_overrides" ADD CONSTRAINT "transaction_overrides_transaction_category_id_fkey" FOREIGN KEY ("transaction_category_id") REFERENCES "transaction_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
