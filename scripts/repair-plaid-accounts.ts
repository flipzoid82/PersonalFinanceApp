import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { repairPlaidAccountDuplicates } from "../src/lib/plaid/account-repair";

const database = new PrismaClient();

async function main() {
  const apply = process.argv.includes("--apply");
  const owners = await database.institutionConnection.findMany({
    where: { provider: "PLAID" },
    distinct: ["userId"],
    select: { userId: true },
  });
  if (owners.length !== 1)
    throw new Error(
      `Expected exactly one owner with Plaid data; found ${owners.length}.`,
    );

  const report = await repairPlaidAccountDuplicates(owners[0].userId, {
    database,
    dryRun: !apply,
  });
  console.log(
    JSON.stringify({
      mode: apply ? "applied" : "dry-run-rolled-back",
      accountsBefore: report.accountsBefore,
      accountsAfter: report.accountsAfter,
      duplicateGroups: report.duplicateGroups,
      accountsMerged: report.accountsMerged,
      transactionsPreserved: report.transactionsPreserved,
      duplicateTransactionsCanceled: report.duplicateTransactionsCanceled,
      recurringStreamsPreserved: report.recurringStreamsPreserved,
      duplicateStreamsDeactivated: report.duplicateStreamsDeactivated,
      calendarEventsPreserved: report.calendarEventsPreserved,
      connectionsRetired: report.connectionsRetired,
    }),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Repair failed.");
    process.exitCode = 1;
  })
  .finally(() => database.$disconnect());
