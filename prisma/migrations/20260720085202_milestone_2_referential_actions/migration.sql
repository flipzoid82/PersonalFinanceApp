-- DropForeignKey
ALTER TABLE "accounts" DROP CONSTRAINT "accounts_data_source_id_fkey";

-- DropForeignKey
ALTER TABLE "balance_snapshots" DROP CONSTRAINT "balance_snapshots_account_id_fkey";

-- DropForeignKey
ALTER TABLE "calendar_events" DROP CONSTRAINT "calendar_events_account_id_fkey";

-- DropForeignKey
ALTER TABLE "import_jobs" DROP CONSTRAINT "import_jobs_data_source_id_fkey";

-- DropForeignKey
ALTER TABLE "institution_connections" DROP CONSTRAINT "institution_connections_data_source_id_fkey";

-- DropForeignKey
ALTER TABLE "investment_balance_snapshots" DROP CONSTRAINT "investment_balance_snapshots_account_id_fkey";

-- DropForeignKey
ALTER TABLE "investment_holdings" DROP CONSTRAINT "investment_holdings_account_id_fkey";

-- DropForeignKey
ALTER TABLE "investment_transactions" DROP CONSTRAINT "investment_transactions_account_id_fkey";

-- DropForeignKey
ALTER TABLE "recurring_streams" DROP CONSTRAINT "recurring_streams_typical_account_id_fkey";

-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_account_id_fkey";

-- AddForeignKey
ALTER TABLE "institution_connections" ADD CONSTRAINT "institution_connections_data_source_id_fkey" FOREIGN KEY ("data_source_id") REFERENCES "data_sources"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_data_source_id_fkey" FOREIGN KEY ("data_source_id") REFERENCES "data_sources"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_streams" ADD CONSTRAINT "recurring_streams_typical_account_id_fkey" FOREIGN KEY ("typical_account_id") REFERENCES "accounts"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investment_holdings" ADD CONSTRAINT "investment_holdings_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investment_balance_snapshots" ADD CONSTRAINT "investment_balance_snapshots_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investment_transactions" ADD CONSTRAINT "investment_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "balance_snapshots" ADD CONSTRAINT "balance_snapshots_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_data_source_id_fkey" FOREIGN KEY ("data_source_id") REFERENCES "data_sources"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
