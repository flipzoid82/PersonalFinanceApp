-- Preserve legacy owner-local transaction links without inventing an economic
-- relationship type. Previously applied HC1 migrations remain unchanged.
ALTER TYPE "TransactionRelationshipType" ADD VALUE 'LEGACY_UNTYPED';
