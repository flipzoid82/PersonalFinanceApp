-- CreateEnum
CREATE TYPE "DataSourceType" AS ENUM ('PLAID', 'CSV_IMPORT', 'MANUAL', 'FIDELITY_IMPORT', 'OTHER_PROVIDER');

-- CreateEnum
CREATE TYPE "DataSourceStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'NEEDS_ATTENTION', 'ERROR');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('ACTIVE', 'NEEDS_REAUTHENTICATION', 'DISCONNECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('CHECKING', 'SAVINGS', 'CREDIT_CARD', 'LOAN', 'MORTGAGE', 'BROKERAGE', 'RETIREMENT', 'FOUR_O_ONE_K', 'MANUAL_ASSET', 'MANUAL_DEBT', 'OTHER');

-- CreateEnum
CREATE TYPE "AccountSource" AS ENUM ('SYNCED', 'IMPORTED', 'MANUAL');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'POSTED', 'CANCELED');

-- CreateEnum
CREATE TYPE "FinancialRole" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER', 'REFUND', 'CREDIT_CARD_PAYMENT', 'INVESTMENT_ACTIVITY', 'DEBT_PAYMENT', 'IGNORED', 'UNCATEGORIZED');

-- CreateEnum
CREATE TYPE "RecurringFlowType" AS ENUM ('BILL', 'SUBSCRIPTION', 'TRANSFER', 'DEBT_PAYMENT', 'CREDIT_CARD_PAYMENT', 'EXPECTED_INCOME', 'OTHER');

-- CreateEnum
CREATE TYPE "RecurringFrequency" AS ENUM ('WEEKLY', 'BIWEEKLY', 'SEMIMONTHLY', 'MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL', 'IRREGULAR');

-- CreateEnum
CREATE TYPE "ConfidenceLevel" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'NEEDS_CONFIRMATION');

-- CreateEnum
CREATE TYPE "RecurringStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'NEEDS_CONFIRMATION');

-- CreateEnum
CREATE TYPE "CalendarEventType" AS ENUM ('BILL', 'SUBSCRIPTION', 'DEBT_PAYMENT', 'CREDIT_CARD_PAYMENT', 'EXPECTED_INCOME', 'OTHER_RECURRING');

-- CreateEnum
CREATE TYPE "CalendarDateSource" AS ENUM ('INFERRED', 'USER_CONFIRMED', 'PROVIDER', 'IMPORTED', 'MANUAL');

-- CreateEnum
CREATE TYPE "CalendarAmountSource" AS ENUM ('FIXED', 'ESTIMATED', 'LAST_OBSERVED', 'PROVIDER', 'IMPORTED', 'MANUAL');

-- CreateEnum
CREATE TYPE "CalendarEventStatus" AS ENUM ('PREDICTED', 'CONFIRMED', 'PAID', 'OVERDUE', 'SKIPPED', 'NEEDS_CONFIRMATION', 'INACTIVE');

-- CreateEnum
CREATE TYPE "InvestmentSource" AS ENUM ('SYNCED', 'IMPORTED', 'MANUAL');

-- CreateEnum
CREATE TYPE "InvestmentTransactionType" AS ENUM ('BUY', 'SELL', 'DIVIDEND', 'INTEREST', 'CONTRIBUTION', 'WITHDRAWAL', 'TRANSFER', 'FEE', 'OTHER');

-- CreateEnum
CREATE TYPE "ManualAssetType" AS ENUM ('HOME', 'OTHER_REAL_ESTATE', 'VEHICLE', 'PRIVATE_ASSET', 'OTHER_ASSET', 'MORTGAGE', 'AUTO_LOAN', 'STUDENT_LOAN', 'PERSONAL_LOAN', 'OTHER_DEBT');

-- CreateEnum
CREATE TYPE "ImportType" AS ENUM ('BANK_TRANSACTIONS_CSV', 'FIDELITY_POSITIONS_CSV', 'FIDELITY_TRANSACTIONS_CSV', 'MANUAL_BALANCE_SNAPSHOT', 'GENERIC_ACCOUNT_BALANCE_CSV');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'PARTIAL', 'FAILED');

-- CreateTable
CREATE TABLE "data_sources" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "source_type" "DataSourceType" NOT NULL,
    "display_name" TEXT NOT NULL,
    "status" "DataSourceStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_updated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "institution_connections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "data_source_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_item_id" TEXT,
    "institution_id" TEXT,
    "institution_name" TEXT NOT NULL,
    "encrypted_access_token" TEXT,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_successful_sync_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "institution_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "data_source_id" TEXT NOT NULL,
    "institution_connection_id" TEXT,
    "provider_account_id" TEXT,
    "name" TEXT NOT NULL,
    "official_name" TEXT,
    "institution_name" TEXT,
    "account_type" "AccountType" NOT NULL,
    "account_subtype" TEXT,
    "source" "AccountSource" NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "current_balance" DECIMAL(19,4) NOT NULL,
    "available_balance" DECIMAL(19,4),
    "credit_limit" DECIMAL(19,4),
    "is_manual" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_synced_at" TIMESTAMP(3),
    "last_imported_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "provider_transaction_id" TEXT,
    "original_name" TEXT NOT NULL,
    "merchant_name" TEXT,
    "amount" DECIMAL(19,4) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "authorized_at" TIMESTAMP(3),
    "posted_at" TIMESTAMP(3),
    "status" "TransactionStatus" NOT NULL,
    "provider_category" TEXT,
    "provider_category_confidence" DECIMAL(5,4),
    "pending_provider_transaction_id" TEXT,
    "pending_transaction_id" TEXT,
    "raw_provider_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_overrides" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "merchant_name_override" TEXT,
    "category_override" TEXT,
    "financial_role_override" "FinancialRole",
    "notes" TEXT,
    "excluded_from_reports" BOOLEAN NOT NULL DEFAULT false,
    "linked_transaction_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transaction_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_streams" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "merchant_name" TEXT,
    "description" TEXT NOT NULL,
    "flow_type" "RecurringFlowType" NOT NULL,
    "frequency" "RecurringFrequency" NOT NULL,
    "average_amount" DECIMAL(19,4) NOT NULL,
    "last_amount" DECIMAL(19,4) NOT NULL,
    "first_date" DATE NOT NULL,
    "last_date" DATE NOT NULL,
    "predicted_next_date" DATE NOT NULL,
    "predicted_posting_date" DATE,
    "confirmed_due_date" DATE,
    "date_source" "CalendarDateSource" NOT NULL,
    "confidence_level" "ConfidenceLevel" NOT NULL,
    "confidence_score" DECIMAL(5,4),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "status" "RecurringStatus" NOT NULL DEFAULT 'ACTIVE',
    "category" TEXT,
    "typical_account_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_streams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "recurring_stream_id" TEXT,
    "account_id" TEXT,
    "linked_transaction_id" TEXT,
    "event_type" "CalendarEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "event_date" DATE NOT NULL,
    "predicted_posting_date" DATE,
    "expected_amount" DECIMAL(19,4),
    "actual_amount" DECIMAL(19,4),
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "date_source" "CalendarDateSource" NOT NULL,
    "amount_source" "CalendarAmountSource" NOT NULL,
    "confidence_level" "ConfidenceLevel" NOT NULL,
    "status" "CalendarEventStatus" NOT NULL,
    "is_user_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_overrides" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "calendar_event_id" TEXT,
    "recurring_stream_id" TEXT,
    "confirmed_due_date" DATE,
    "expected_amount_override" DECIMAL(19,4),
    "frequency_override" "RecurringFrequency",
    "status_override" "CalendarEventStatus",
    "not_a_bill" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investment_holdings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "source" "InvestmentSource" NOT NULL,
    "security_name" TEXT NOT NULL,
    "ticker_symbol" TEXT,
    "security_type" TEXT,
    "quantity" DECIMAL(28,10),
    "price" DECIMAL(19,4),
    "current_value" DECIMAL(19,4) NOT NULL,
    "cost_basis" DECIMAL(19,4),
    "vested_quantity" DECIMAL(28,10),
    "vested_value" DECIMAL(19,4),
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "as_of_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investment_holdings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investment_balance_snapshots" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "total_value" DECIMAL(19,4) NOT NULL,
    "vested_value" DECIMAL(19,4),
    "source" "InvestmentSource" NOT NULL,
    "as_of_date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "investment_balance_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investment_transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "source" "InvestmentSource" NOT NULL,
    "provider_investment_transaction_id" TEXT,
    "transaction_date" TIMESTAMP(3) NOT NULL,
    "transaction_type" "InvestmentTransactionType" NOT NULL,
    "security_name" TEXT,
    "ticker_symbol" TEXT,
    "amount" DECIMAL(19,4),
    "quantity" DECIMAL(28,10),
    "price" DECIMAL(19,4),
    "fees" DECIMAL(19,4),
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "raw_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manual_assets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "asset_type" "ManualAssetType" NOT NULL,
    "current_value" DECIMAL(19,4) NOT NULL,
    "cost_basis" DECIMAL(19,4),
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "acquired_at" DATE,
    "is_debt" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manual_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "balance_snapshots" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "current_balance" DECIMAL(19,4) NOT NULL,
    "available_balance" DECIMAL(19,4),
    "captured_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "balance_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "data_source_id" TEXT NOT NULL,
    "source_name" TEXT NOT NULL,
    "import_type" "ImportType" NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "imported_row_count" INTEGER NOT NULL DEFAULT 0,
    "rejected_row_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "data_sources_user_id_idx" ON "data_sources"("user_id");

-- CreateIndex
CREATE INDEX "data_sources_user_id_source_type_idx" ON "data_sources"("user_id", "source_type");

-- CreateIndex
CREATE INDEX "institution_connections_user_id_idx" ON "institution_connections"("user_id");

-- CreateIndex
CREATE INDEX "institution_connections_data_source_id_idx" ON "institution_connections"("data_source_id");

-- CreateIndex
CREATE INDEX "institution_connections_institution_id_idx" ON "institution_connections"("institution_id");

-- CreateIndex
CREATE UNIQUE INDEX "institution_connections_provider_provider_item_id_key" ON "institution_connections"("provider", "provider_item_id");

-- CreateIndex
CREATE INDEX "accounts_user_id_idx" ON "accounts"("user_id");

-- CreateIndex
CREATE INDEX "accounts_user_id_account_type_is_active_idx" ON "accounts"("user_id", "account_type", "is_active");

-- CreateIndex
CREATE INDEX "accounts_institution_connection_id_idx" ON "accounts"("institution_connection_id");

-- CreateIndex
CREATE INDEX "accounts_institution_name_idx" ON "accounts"("institution_name");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_data_source_id_provider_account_id_key" ON "accounts"("data_source_id", "provider_account_id");

-- CreateIndex
CREATE INDEX "transactions_user_id_idx" ON "transactions"("user_id");

-- CreateIndex
CREATE INDEX "transactions_account_id_posted_at_idx" ON "transactions"("account_id", "posted_at");

-- CreateIndex
CREATE INDEX "transactions_merchant_name_idx" ON "transactions"("merchant_name");

-- CreateIndex
CREATE INDEX "transactions_status_idx" ON "transactions"("status");

-- CreateIndex
CREATE INDEX "transactions_pending_transaction_id_idx" ON "transactions"("pending_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_account_id_provider_transaction_id_key" ON "transactions"("account_id", "provider_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_overrides_transaction_id_key" ON "transaction_overrides"("transaction_id");

-- CreateIndex
CREATE INDEX "transaction_overrides_user_id_idx" ON "transaction_overrides"("user_id");

-- CreateIndex
CREATE INDEX "transaction_overrides_linked_transaction_id_idx" ON "transaction_overrides"("linked_transaction_id");

-- CreateIndex
CREATE INDEX "recurring_streams_user_id_idx" ON "recurring_streams"("user_id");

-- CreateIndex
CREATE INDEX "recurring_streams_user_id_predicted_next_date_idx" ON "recurring_streams"("user_id", "predicted_next_date");

-- CreateIndex
CREATE INDEX "recurring_streams_typical_account_id_idx" ON "recurring_streams"("typical_account_id");

-- CreateIndex
CREATE INDEX "calendar_events_user_id_idx" ON "calendar_events"("user_id");

-- CreateIndex
CREATE INDEX "calendar_events_user_id_event_date_idx" ON "calendar_events"("user_id", "event_date");

-- CreateIndex
CREATE INDEX "calendar_events_status_event_date_idx" ON "calendar_events"("status", "event_date");

-- CreateIndex
CREATE INDEX "calendar_events_recurring_stream_id_idx" ON "calendar_events"("recurring_stream_id");

-- CreateIndex
CREATE INDEX "calendar_events_account_id_idx" ON "calendar_events"("account_id");

-- CreateIndex
CREATE INDEX "calendar_events_linked_transaction_id_idx" ON "calendar_events"("linked_transaction_id");

-- CreateIndex
CREATE INDEX "calendar_overrides_user_id_idx" ON "calendar_overrides"("user_id");

-- CreateIndex
CREATE INDEX "calendar_overrides_calendar_event_id_idx" ON "calendar_overrides"("calendar_event_id");

-- CreateIndex
CREATE INDEX "calendar_overrides_recurring_stream_id_idx" ON "calendar_overrides"("recurring_stream_id");

-- CreateIndex
CREATE INDEX "investment_holdings_user_id_idx" ON "investment_holdings"("user_id");

-- CreateIndex
CREATE INDEX "investment_holdings_account_id_as_of_date_idx" ON "investment_holdings"("account_id", "as_of_date");

-- CreateIndex
CREATE INDEX "investment_holdings_ticker_symbol_idx" ON "investment_holdings"("ticker_symbol");

-- CreateIndex
CREATE INDEX "investment_balance_snapshots_user_id_idx" ON "investment_balance_snapshots"("user_id");

-- CreateIndex
CREATE INDEX "investment_balance_snapshots_account_id_as_of_date_idx" ON "investment_balance_snapshots"("account_id", "as_of_date");

-- CreateIndex
CREATE UNIQUE INDEX "investment_balance_snapshots_account_id_source_as_of_date_key" ON "investment_balance_snapshots"("account_id", "source", "as_of_date");

-- CreateIndex
CREATE INDEX "investment_transactions_user_id_idx" ON "investment_transactions"("user_id");

-- CreateIndex
CREATE INDEX "investment_transactions_account_id_transaction_date_idx" ON "investment_transactions"("account_id", "transaction_date");

-- CreateIndex
CREATE INDEX "investment_transactions_ticker_symbol_idx" ON "investment_transactions"("ticker_symbol");

-- CreateIndex
CREATE UNIQUE INDEX "investment_transactions_account_id_provider_investment_tran_key" ON "investment_transactions"("account_id", "provider_investment_transaction_id");

-- CreateIndex
CREATE INDEX "manual_assets_user_id_idx" ON "manual_assets"("user_id");

-- CreateIndex
CREATE INDEX "manual_assets_user_id_asset_type_is_debt_idx" ON "manual_assets"("user_id", "asset_type", "is_debt");

-- CreateIndex
CREATE INDEX "balance_snapshots_account_id_captured_at_idx" ON "balance_snapshots"("account_id", "captured_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "balance_snapshots_account_id_captured_at_key" ON "balance_snapshots"("account_id", "captured_at");

-- CreateIndex
CREATE INDEX "import_jobs_user_id_idx" ON "import_jobs"("user_id");

-- CreateIndex
CREATE INDEX "import_jobs_data_source_id_idx" ON "import_jobs"("data_source_id");

-- CreateIndex
CREATE INDEX "import_jobs_user_id_status_created_at_idx" ON "import_jobs"("user_id", "status", "created_at");

-- AddForeignKey
ALTER TABLE "data_sources" ADD CONSTRAINT "data_sources_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institution_connections" ADD CONSTRAINT "institution_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institution_connections" ADD CONSTRAINT "institution_connections_data_source_id_fkey" FOREIGN KEY ("data_source_id") REFERENCES "data_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_data_source_id_fkey" FOREIGN KEY ("data_source_id") REFERENCES "data_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_institution_connection_id_fkey" FOREIGN KEY ("institution_connection_id") REFERENCES "institution_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_pending_transaction_id_fkey" FOREIGN KEY ("pending_transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_overrides" ADD CONSTRAINT "transaction_overrides_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_overrides" ADD CONSTRAINT "transaction_overrides_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_overrides" ADD CONSTRAINT "transaction_overrides_linked_transaction_id_fkey" FOREIGN KEY ("linked_transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_streams" ADD CONSTRAINT "recurring_streams_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_streams" ADD CONSTRAINT "recurring_streams_typical_account_id_fkey" FOREIGN KEY ("typical_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_recurring_stream_id_fkey" FOREIGN KEY ("recurring_stream_id") REFERENCES "recurring_streams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_linked_transaction_id_fkey" FOREIGN KEY ("linked_transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_overrides" ADD CONSTRAINT "calendar_overrides_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_overrides" ADD CONSTRAINT "calendar_overrides_calendar_event_id_fkey" FOREIGN KEY ("calendar_event_id") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_overrides" ADD CONSTRAINT "calendar_overrides_recurring_stream_id_fkey" FOREIGN KEY ("recurring_stream_id") REFERENCES "recurring_streams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investment_holdings" ADD CONSTRAINT "investment_holdings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investment_holdings" ADD CONSTRAINT "investment_holdings_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investment_balance_snapshots" ADD CONSTRAINT "investment_balance_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investment_balance_snapshots" ADD CONSTRAINT "investment_balance_snapshots_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investment_transactions" ADD CONSTRAINT "investment_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investment_transactions" ADD CONSTRAINT "investment_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_assets" ADD CONSTRAINT "manual_assets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "balance_snapshots" ADD CONSTRAINT "balance_snapshots_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_data_source_id_fkey" FOREIGN KEY ("data_source_id") REFERENCES "data_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
