// @vitest-environment node

import {
  AccountSource,
  AccountType,
  ImportCandidateStatus,
  ImportSourceStatus,
  ImportStatus,
  ImportType,
  Prisma,
  PrismaClient,
  TransactionStatus,
} from "@prisma/client";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getImportDetail } from "./queries";
import {
  commitImport,
  cleanupExpiredImportSources,
  createImportFromUpload,
  deleteImportSource,
  mapCsvImport,
  resolveImportAccount,
  undoImport,
} from "./service";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeDatabase = testDatabaseUrl ? describe : describe.skip;
let prisma: PrismaClient;
let storageDirectory: string;
const ownerEmail = "milestone-11-owner@example.test";
const otherEmail = "milestone-11-other@example.test";

async function clearOwners() {
  const owners = await prisma.user.findMany({
    where: { email: { in: [ownerEmail, otherEmail] } },
    select: { id: true },
  });
  const ownerIds = owners.map(({ id }) => id);
  if (!ownerIds.length) return;
  const jobs = await prisma.importJob.findMany({
    where: { userId: { in: ownerIds } },
    select: { id: true },
  });
  const jobIds = jobs.map(({ id }) => id);
  await prisma.transactionOverride.deleteMany({
    where: { userId: { in: ownerIds } },
  });
  await prisma.calendarOverride.deleteMany({
    where: { userId: { in: ownerIds } },
  });
  await prisma.calendarEvent.deleteMany({
    where: { userId: { in: ownerIds } },
  });
  await prisma.recurringStream.deleteMany({
    where: { userId: { in: ownerIds } },
  });
  await prisma.transaction.deleteMany({ where: { userId: { in: ownerIds } } });
  await prisma.investmentTransaction.deleteMany({
    where: { userId: { in: ownerIds } },
  });
  await prisma.investmentHolding.deleteMany({
    where: { userId: { in: ownerIds } },
  });
  await prisma.investmentBalanceSnapshot.deleteMany({
    where: { userId: { in: ownerIds } },
  });
  await prisma.balanceSnapshot.deleteMany({
    where: { userId: { in: ownerIds } },
  });
  if (jobIds.length) {
    await prisma.importJob.updateMany({
      where: { id: { in: jobIds } },
      data: { matchedAccountId: null },
    });
    await prisma.importAccountMatch.updateMany({
      where: { importJobId: { in: jobIds } },
      data: { matchedAccountId: null },
    });
  }
  await prisma.account.updateMany({
    where: { userId: { in: ownerIds } },
    data: { createdByImportJobId: null },
  });
  await prisma.importCandidate.deleteMany({
    where: { importJobId: { in: jobIds } },
  });
  await prisma.importAccountMatch.deleteMany({
    where: { importJobId: { in: jobIds } },
  });
  await prisma.importJob.deleteMany({ where: { id: { in: jobIds } } });
  await prisma.account.deleteMany({ where: { userId: { in: ownerIds } } });
  await prisma.dataSource.deleteMany({ where: { userId: { in: ownerIds } } });
  await prisma.authSession.deleteMany({ where: { userId: { in: ownerIds } } });
  await prisma.user.deleteMany({ where: { id: { in: ownerIds } } });
}

async function setupOwner() {
  const owner = await prisma.user.create({
    data: { email: ownerEmail, passwordHash: "synthetic-hash" },
  });
  const source = await prisma.dataSource.create({
    data: { userId: owner.id, sourceType: "MANUAL", displayName: "Manual" },
  });
  const account = await prisma.account.create({
    data: {
      userId: owner.id,
      dataSourceId: source.id,
      name: "Synthetic Savings",
      accountType: AccountType.OTHER,
      source: AccountSource.MANUAL,
      currency: "USD",
      currentBalance: new Prisma.Decimal("50"),
      isManual: true,
    },
  });
  return { owner, account };
}

function balanceFile(date = "2026-08-01") {
  return new File(
    [
      `Account,Date,Balance,Currency\nSynthetic Savings,${date},1234.5678,USD\nSynthetic Savings,bad-date,99.00,USD`,
    ],
    "synthetic-balances.csv",
    { type: "text/csv" },
  );
}

function syntheticTextPdf(text: string) {
  const escaped = text
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
  const stream = `BT /F1 12 Tf 72 720 Td (${escaped}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1))
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
}

async function prepareBalanceImport(ownerId: string, date = "2026-08-01") {
  const id = await createImportFromUpload(
    ownerId,
    balanceFile(date),
    ImportType.GENERIC_ACCOUNT_BALANCE_CSV,
  );
  await mapCsvImport(ownerId, id, {
    importType: "GENERIC_ACCOUNT_BALANCE_CSV",
    account: "Account",
    asOfDate: "Date",
    value: "Balance",
    currency: "Currency",
  });
  return id;
}

describeDatabase("Milestone 11 import lifecycle", () => {
  beforeAll(async () => {
    const url = new URL(testDatabaseUrl!);
    if (!url.pathname.toLocaleLowerCase().includes("test"))
      throw new Error("TEST_DATABASE_URL must name an isolated test database.");
    if (process.env.DATABASE_URL !== testDatabaseUrl)
      throw new Error(
        "DATABASE_URL must point to the isolated test database for import integration tests.",
      );
    prisma = new PrismaClient({
      datasources: { db: { url: testDatabaseUrl } },
    });
    await prisma.$connect();
    storageDirectory = await mkdtemp(
      path.join(tmpdir(), "finance-import-integration-"),
    );
    process.env.IMPORT_STORAGE_DIR = storageDirectory;
    process.env.IMPORT_FILE_ENCRYPTION_KEY = "9".repeat(64);
  });

  beforeEach(clearOwners);
  afterAll(async () => {
    await clearOwners();
    await prisma.$disconnect();
    await rm(storageDirectory, { recursive: true, force: true });
  });

  it("commits valid rows atomically, retains rejected rows, and preserves exact Decimal provenance", async () => {
    const { owner, account } = await setupOwner();
    const id = await prepareBalanceImport(owner.id);
    const plan = await getImportDetail(owner.id, id);
    expect(plan).toMatchObject({
      status: ImportStatus.READY,
      rejectedRowCount: 1,
      parserFamily: "GenericBalanceCsvParser",
      parserVersion: "1.0.0",
    });
    expect(plan?.candidates.map(({ status }) => status)).toEqual([
      ImportCandidateStatus.READY,
      ImportCandidateStatus.REJECTED,
    ]);

    await commitImport(owner.id, id);
    const snapshot = await prisma.balanceSnapshot.findFirstOrThrow({
      where: { importJobId: id, accountId: account.id },
    });
    expect(snapshot.currentBalance.toFixed(4)).toBe("1234.5678");
    expect(snapshot.importIdentityKey).toMatch(/^[a-f0-9]{64}$/);
    expect(
      await prisma.importJob.findUniqueOrThrow({ where: { id } }),
    ).toMatchObject({
      status: ImportStatus.PARTIAL,
      importedRowCount: 1,
      rejectedRowCount: 1,
    });
  });

  it("auto-detects a balance CSV and keeps the detected type stable through review", async () => {
    const { owner } = await setupOwner();
    const id = await createImportFromUpload(owner.id, balanceFile());
    expect(
      await prisma.importJob.findUniqueOrThrow({ where: { id } }),
    ).toMatchObject({
      importType: ImportType.GENERIC_ACCOUNT_BALANCE_CSV,
      status: ImportStatus.NEEDS_REVIEW,
    });
    await mapCsvImport(owner.id, id, {
      importType: "GENERIC_ACCOUNT_BALANCE_CSV",
      account: "Account",
      asOfDate: "Date",
      value: "Balance",
      currency: "Currency",
    });
    expect(
      await prisma.importJob.findUniqueOrThrow({ where: { id } }),
    ).toMatchObject({ importType: ImportType.GENERIC_ACCOUNT_BALANCE_CSV });
  });

  it("retains an encrypted source and records a truthful reason when parsing fails", async () => {
    const { owner } = await setupOwner();
    const id = await createImportFromUpload(
      owner.id,
      new File(
        [syntheticTextPdf("Fidelity trade confirmation")],
        "synthetic-trade.pdf",
        { type: "application/pdf" },
      ),
    );
    const job = await prisma.importJob.findUniqueOrThrow({ where: { id } });
    expect(job).toMatchObject({
      importType: ImportType.FIDELITY_TRADE_CONFIRMATION,
      status: ImportStatus.FAILED,
      sourceStatus: ImportSourceStatus.RETAINED,
    });
    expect(job.sourceStorageKey).toBeTruthy();
    expect(job.planData).toMatchObject({
      stage: "failed",
      failureMessage: expect.stringContaining(
        "No supported financial observations",
      ),
    });
  });

  it("detects repeated files/observations and prevents repeated confirmation duplicates", async () => {
    const { owner } = await setupOwner();
    const first = await prepareBalanceImport(owner.id);
    await commitImport(owner.id, first);
    const second = await prepareBalanceImport(owner.id);
    const detail = await getImportDetail(owner.id, second);
    expect(detail?.candidates[0].status).toBe(ImportCandidateStatus.DUPLICATE);
    expect(detail?.duplicateRowCount).toBe(1);
    expect(
      await prisma.balanceSnapshot.count({ where: { userId: owner.id } }),
    ).toBe(1);
  });

  it("undoes only import-created records after source deletion and retains the Reverted audit", async () => {
    const { owner, account } = await setupOwner();
    const id = await prepareBalanceImport(owner.id);
    await commitImport(owner.id, id);
    await deleteImportSource(owner.id, id);
    expect(
      await prisma.importJob.findUniqueOrThrow({ where: { id } }),
    ).toMatchObject({
      sourceStatus: ImportSourceStatus.DELETED,
    });
    await undoImport(owner.id, id);
    expect(
      await prisma.balanceSnapshot.count({ where: { accountId: account.id } }),
    ).toBe(0);
    expect(
      await prisma.account.findUnique({ where: { id: account.id } }),
    ).not.toBeNull();
    expect(
      await prisma.importJob.findUniqueOrThrow({ where: { id } }),
    ).toMatchObject({
      status: ImportStatus.REVERTED,
      sourceStatus: ImportSourceStatus.DELETED,
    });
  });

  it("enforces owner scoping for history and mutations", async () => {
    const { owner } = await setupOwner();
    const other = await prisma.user.create({
      data: { email: otherEmail, passwordHash: "synthetic-hash" },
    });
    const id = await prepareBalanceImport(owner.id);
    expect(await getImportDetail(other.id, id)).toBeNull();
    await expect(commitImport(other.id, id)).rejects.toThrow("not ready");
    expect(
      await prisma.balanceSnapshot.count({ where: { userId: owner.id } }),
    ).toBe(0);
  });

  it("cleans expired retained sources while preserving the import audit", async () => {
    const { owner } = await setupOwner();
    const id = await prepareBalanceImport(owner.id);
    await prisma.importJob.update({
      where: { id },
      data: { sourceRetainUntil: new Date("2020-01-01T00:00:00.000Z") },
    });
    await expect(
      cleanupExpiredImportSources(new Date()),
    ).resolves.toBeGreaterThanOrEqual(1);
    expect(
      await prisma.importJob.findUniqueOrThrow({ where: { id } }),
    ).toMatchObject({
      sourceStatus: ImportSourceStatus.DELETED,
      sourceStorageKey: null,
    });
  });

  it("blocks Undo when an import-created account has a later dependency", async () => {
    const owner = await prisma.user.create({
      data: { email: ownerEmail, passwordHash: "synthetic-hash" },
    });
    const id = await createImportFromUpload(
      owner.id,
      new File(
        [
          "Account,Date,Balance,Currency\nNew Imported Account,2026-08-01,100,USD",
        ],
        "new-account.csv",
        { type: "text/csv" },
      ),
      ImportType.GENERIC_ACCOUNT_BALANCE_CSV,
    );
    await mapCsvImport(owner.id, id, {
      importType: "GENERIC_ACCOUNT_BALANCE_CSV",
      account: "Account",
      asOfDate: "Date",
      value: "Balance",
      currency: "Currency",
    });
    const proposedAccount = await prisma.importAccountMatch.findFirstOrThrow({
      where: { importJobId: id },
    });
    await resolveImportAccount(owner.id, id, proposedAccount.id, "create");
    await commitImport(owner.id, id);
    const account = await prisma.account.findFirstOrThrow({
      where: { createdByImportJobId: id },
    });
    await prisma.transaction.create({
      data: {
        userId: owner.id,
        accountId: account.id,
        originalName: "Synthetic later activity",
        amount: new Prisma.Decimal("1"),
        status: TransactionStatus.POSTED,
        postedAt: new Date("2026-08-02T00:00:00.000Z"),
      },
    });
    await expect(undoImport(owner.id, id)).rejects.toThrow(
      "dependent financial records",
    );
    expect(
      await prisma.importJob.findUniqueOrThrow({ where: { id } }),
    ).toMatchObject({
      status: ImportStatus.COMPLETED,
    });
  });

  it("preserves later duplicate audit history when undo removes an import-created account", async () => {
    const owner = await prisma.user.create({
      data: { email: ownerEmail, passwordHash: "synthetic-hash" },
    });
    const file = () =>
      new File(
        [
          "Account,Date,Balance,Currency\nSynthetic Imported Account,2026-08-01,100,USD",
        ],
        "synthetic-created-account.csv",
        { type: "text/csv" },
      );
    const prepare = async () => {
      const id = await createImportFromUpload(
        owner.id,
        file(),
        ImportType.GENERIC_ACCOUNT_BALANCE_CSV,
      );
      await mapCsvImport(owner.id, id, {
        importType: "GENERIC_ACCOUNT_BALANCE_CSV",
        account: "Account",
        asOfDate: "Date",
        value: "Balance",
        currency: "Currency",
      });
      return id;
    };

    const first = await prepare();
    const firstMatch = await prisma.importAccountMatch.findFirstOrThrow({
      where: { importJobId: first },
    });
    await resolveImportAccount(owner.id, first, firstMatch.id, "create");
    await commitImport(owner.id, first);
    const createdAccount = await prisma.account.findFirstOrThrow({
      where: { createdByImportJobId: first },
    });

    const duplicate = await prepare();
    expect(
      await prisma.importAccountMatch.findFirstOrThrow({
        where: { importJobId: duplicate },
      }),
    ).toMatchObject({ matchedAccountId: createdAccount.id });

    await undoImport(owner.id, first);

    expect(
      await prisma.account.findUnique({ where: { id: createdAccount.id } }),
    ).toBeNull();
    expect(
      await prisma.importJob.findUniqueOrThrow({ where: { id: first } }),
    ).toMatchObject({ status: ImportStatus.REVERTED });
    expect(
      await prisma.importJob.findUniqueOrThrow({ where: { id: duplicate } }),
    ).toBeTruthy();
    expect(
      await prisma.importAccountMatch.findFirstOrThrow({
        where: { importJobId: duplicate },
      }),
    ).toMatchObject({ matchedAccountId: null });
  });
});
