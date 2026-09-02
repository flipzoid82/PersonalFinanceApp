-- Defense-in-depth owner scoping for every HC1 cross-record reference.
CREATE UNIQUE INDEX "transactions_id_user_id_key" ON "transactions"("id", "user_id");
CREATE UNIQUE INDEX "accounts_id_user_id_key" ON "accounts"("id", "user_id");
CREATE UNIQUE INDEX "transaction_categories_id_user_id_key" ON "transaction_categories"("id", "user_id");

ALTER TABLE "transaction_classifications"
  ADD CONSTRAINT "transaction_classifications_transaction_owner_fkey"
  FOREIGN KEY ("transaction_id", "user_id") REFERENCES "transactions"("id", "user_id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "transaction_classifications_category_owner_fkey"
  FOREIGN KEY ("transaction_category_id", "user_id") REFERENCES "transaction_categories"("id", "user_id")
  ON DELETE SET NULL ("transaction_category_id") ON UPDATE CASCADE;

ALTER TABLE "classification_rules"
  ADD CONSTRAINT "classification_rules_account_owner_fkey"
  FOREIGN KEY ("account_id", "user_id") REFERENCES "accounts"("id", "user_id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "classification_rules_category_owner_fkey"
  FOREIGN KEY ("transaction_category_id", "user_id") REFERENCES "transaction_categories"("id", "user_id")
  ON DELETE SET NULL ("transaction_category_id") ON UPDATE CASCADE;

ALTER TABLE "transaction_allocations"
  ADD CONSTRAINT "transaction_allocations_transaction_owner_fkey"
  FOREIGN KEY ("transaction_id", "user_id") REFERENCES "transactions"("id", "user_id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "transaction_allocations_category_owner_fkey"
  FOREIGN KEY ("transaction_category_id", "user_id") REFERENCES "transaction_categories"("id", "user_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "transaction_relationships"
  ADD CONSTRAINT "transaction_relationships_source_owner_fkey"
  FOREIGN KEY ("source_transaction_id", "user_id") REFERENCES "transactions"("id", "user_id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "transaction_relationships_target_owner_fkey"
  FOREIGN KEY ("target_transaction_id", "user_id") REFERENCES "transactions"("id", "user_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "transaction_overrides"
  ADD CONSTRAINT "transaction_overrides_category_owner_fkey"
  FOREIGN KEY ("transaction_category_id", "user_id") REFERENCES "transaction_categories"("id", "user_id")
  ON DELETE SET NULL ("transaction_category_id") ON UPDATE CASCADE;
