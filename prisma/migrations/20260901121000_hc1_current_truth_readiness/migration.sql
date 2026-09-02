-- Support the bounded current-readiness probe without changing either applied
-- HC1 migration. This remains a forward-only performance migration.
CREATE INDEX "transaction_classifications_user_id_classifier_version_idx"
  ON "transaction_classifications"("user_id", "classifier_version");
