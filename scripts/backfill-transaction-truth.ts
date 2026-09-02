import { PrismaClient } from "@prisma/client";
import { backfillOwnerTransactionTruth } from "../src/lib/transactions/truth";

const prisma = new PrismaClient();

async function main() {
  const owners = await prisma.user.findMany({ select: { id: true } });
  const totals = {
    encountered: 0,
    internalTransfer: 0,
    creditCardPayment: 0,
    refund: 0,
    reimbursement: 0,
    legacyUntyped: 0,
    structurallyInvalid: 0,
    stillNonNull: 0,
    functionallyLegacyDependent: 0,
    correspondingTypedRelationships: 0,
    rerunDelta: 0,
  };
  for (const owner of owners) {
    const inventory = await backfillOwnerTransactionTruth(owner.id, prisma);
    totals.encountered += inventory.encountered;
    totals.internalTransfer +=
      inventory.deterministicallyConverted.INTERNAL_TRANSFER;
    totals.creditCardPayment +=
      inventory.deterministicallyConverted.CREDIT_CARD_PAYMENT;
    totals.refund += inventory.deterministicallyConverted.REFUND;
    totals.reimbursement += inventory.deterministicallyConverted.REIMBURSEMENT;
    totals.legacyUntyped += inventory.legacyUntyped;
    totals.structurallyInvalid += inventory.structurallyInvalid;
    totals.stillNonNull += inventory.stillNonNull;
    totals.functionallyLegacyDependent += inventory.functionallyLegacyDependent;
    totals.correspondingTypedRelationships +=
      inventory.correspondingTypedRelationships;
    totals.rerunDelta += inventory.rerunDelta;
  }
  console.log(
    `Transaction truth backfill completed for ${owners.length} owner(s).`,
  );
  console.log(
    [
      `Legacy links: encountered=${totals.encountered}`,
      `converted.internalTransfer=${totals.internalTransfer}`,
      `converted.creditCardPayment=${totals.creditCardPayment}`,
      `converted.refund=${totals.refund}`,
      `converted.reimbursement=${totals.reimbursement}`,
      `legacyUntyped=${totals.legacyUntyped}`,
      `structurallyInvalid=${totals.structurallyInvalid}`,
      `stillNonNull=${totals.stillNonNull}`,
      `functionallyLegacyDependent=${totals.functionallyLegacyDependent}`,
      `correspondingTyped=${totals.correspondingTypedRelationships}`,
      `rerunDelta=${totals.rerunDelta}`,
    ].join("; "),
  );
}

main()
  .catch(() => {
    console.error(
      "Transaction truth backfill failed. No private transaction data was logged.",
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
