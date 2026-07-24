// @vitest-environment node

import {
  AccountSource,
  AccountType,
  CalendarDateSource,
  CalendarEventStatus,
  DataSourceType,
  InvestmentSource,
  Prisma,
  PrismaClient,
  TransactionStatus,
} from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { seedDevelopmentData } from "./seed";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeDatabase = testDatabaseUrl ? describe : describe.skip;
let prisma: PrismaClient;

async function clearTestData() {
  await prisma.calendarOverride.deleteMany();
  await prisma.transactionOverride.deleteMany();
  await prisma.calendarEvent.deleteMany();
  await prisma.investmentHolding.deleteMany();
  await prisma.investmentBalanceSnapshot.deleteMany();
  await prisma.investmentTransaction.deleteMany();
  await prisma.balanceSnapshot.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.recurringStream.deleteMany();
  await prisma.importJob.deleteMany();
  await prisma.account.deleteMany();
  await prisma.institutionConnection.deleteMany();
  await prisma.dataSource.deleteMany();
  await prisma.manualAsset.deleteMany();
  await prisma.authSession.deleteMany();
  await prisma.user.deleteMany();
}

describeDatabase("Milestone 2 data model", () => {
  beforeAll(async () => {
    const url = new URL(testDatabaseUrl!);
    if (!url.pathname.toLowerCase().includes("test")) {
      throw new Error("TEST_DATABASE_URL must name an isolated test database.");
    }
    prisma = new PrismaClient({
      datasources: { db: { url: testDatabaseUrl } },
    });
    await prisma.$connect();
  });

  beforeEach(clearTestData);
  afterAll(async () => prisma?.$disconnect());

  it("seeds synthetic data idempotently without replacing the owner", async () => {
    const owner = await prisma.user.create({
      data: {
        email: "existing-owner@example.test",
        displayName: "Existing Owner",
        passwordHash: "existing-hash",
      },
    });

    await seedDevelopmentData(prisma);
    await seedDevelopmentData(prisma);

    expect(await prisma.user.count()).toBe(1);
    expect(
      await prisma.user.findUnique({ where: { id: owner.id } }),
    ).toMatchObject({
      email: "existing-owner@example.test",
      passwordHash: "existing-hash",
    });
    expect(await prisma.dataSource.count()).toBe(3);
    expect(await prisma.importJob.count()).toBe(1);
  });

  it("preserves exact monetary values and explicit ownership relationships", async () => {
    const { ownerId } = await seedDevelopmentData(prisma);
    const account = await prisma.account.findUniqueOrThrow({
      where: { id: "seed_account_checking" },
      include: { user: true, dataSource: true },
    });
    const transaction = await prisma.transaction.findUniqueOrThrow({
      where: { id: "seed_transaction_posted" },
    });

    expect(account.userId).toBe(ownerId);
    expect(account.dataSource.userId).toBe(ownerId);
    expect(transaction.userId).toBe(ownerId);
    expect(transaction.accountId).toBe(account.id);
    expect(account.currentBalance.toFixed(4)).toBe("4321.9876");
    expect(transaction.amount.toFixed(4)).toBe("118.4321");
  });

  it("keeps overrides separate from immutable source values", async () => {
    await seedDevelopmentData(prisma);
    const transaction = await prisma.transaction.findUniqueOrThrow({
      where: { id: "seed_transaction_posted" },
      include: { override: true },
    });

    expect(transaction.originalName).toBe("SYNTHETIC ELECTRIC SERVICE WEB");
    expect(transaction.merchantName).toBe("Example Electric");
    expect(transaction.override?.merchantNameOverride).toBe(
      "Example Electric Utility",
    );
  });

  it("enforces provider identifiers only within their true context", async () => {
    const { ownerId } = await seedDevelopmentData(prisma);
    const source = await prisma.dataSource.findUniqueOrThrow({
      where: { id: "seed_source_plaid" },
    });

    await expect(
      prisma.account.create({
        data: {
          userId: ownerId,
          dataSourceId: source.id,
          providerAccountId: "synthetic-checking-001",
          name: "Duplicate provider account",
          accountType: AccountType.CHECKING,
          source: AccountSource.SYNCED,
          currentBalance: new Prisma.Decimal("0.0000"),
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });

    const otherSource = await prisma.dataSource.create({
      data: {
        userId: ownerId,
        sourceType: DataSourceType.OTHER_PROVIDER,
        displayName: "Other synthetic provider",
      },
    });
    await expect(
      prisma.account.create({
        data: {
          userId: ownerId,
          dataSourceId: otherSource.id,
          providerAccountId: "synthetic-checking-001",
          name: "Same ID, valid different source",
          accountType: AccountType.CHECKING,
          source: AccountSource.SYNCED,
          currentBalance: new Prisma.Decimal("0.0000"),
        },
      }),
    ).resolves.toBeDefined();
  });

  it("stores predicted and confirmed calendar concepts side by side", async () => {
    await seedDevelopmentData(prisma);
    const events = await prisma.calendarEvent.findMany({
      orderBy: { eventDate: "asc" },
    });

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: CalendarEventStatus.PREDICTED,
          dateSource: CalendarDateSource.INFERRED,
          isUserConfirmed: false,
        }),
        expect.objectContaining({
          status: CalendarEventStatus.CONFIRMED,
          dateSource: CalendarDateSource.USER_CONFIRMED,
          isUserConfirmed: true,
        }),
      ]),
    );
  });

  it("stores imported and manual investment records together", async () => {
    await seedDevelopmentData(prisma);
    const holdings = await prisma.investmentHolding.findMany();
    const snapshot = await prisma.investmentBalanceSnapshot.findUniqueOrThrow({
      where: { id: "seed_investment_snapshot" },
    });

    expect(holdings.map(({ source }) => source)).toEqual(
      expect.arrayContaining([
        InvestmentSource.IMPORTED,
        InvestmentSource.MANUAL,
      ]),
    );
    expect(snapshot.source).toBe(InvestmentSource.IMPORTED);
  });

  it("cascades overrides, preserves account history, and purges owner data", async () => {
    const { ownerId } = await seedDevelopmentData(prisma);

    await prisma.transaction.delete({
      where: { id: "seed_transaction_posted" },
    });
    expect(
      await prisma.transactionOverride.findUnique({
        where: { id: "seed_transaction_override" },
      }),
    ).toBeNull();

    await expect(
      prisma.account.delete({ where: { id: "seed_account_checking" } }),
    ).rejects.toMatchObject({ code: "P2003" });

    await prisma.user.delete({ where: { id: ownerId } });
    expect(await prisma.dataSource.count()).toBe(0);
    expect(await prisma.account.count()).toBe(0);
    expect(await prisma.transaction.count()).toBe(0);
    expect(await prisma.manualAsset.count()).toBe(0);
  });

  it("sets connection links to null without deleting accounts or manual assets", async () => {
    await seedDevelopmentData(prisma);
    await prisma.institutionConnection.delete({
      where: { id: "seed_connection_bank" },
    });

    const account = await prisma.account.findUniqueOrThrow({
      where: { id: "seed_account_checking" },
    });
    expect(account.institutionConnectionId).toBeNull();
    expect(await prisma.manualAsset.count()).toBe(5);
  });

  it("supports pending-to-posted linkage without changing the pending source", async () => {
    const { ownerId } = await seedDevelopmentData(prisma);
    const pending = await prisma.transaction.findUniqueOrThrow({
      where: { id: "seed_transaction_pending" },
    });
    const posted = await prisma.transaction.create({
      data: {
        userId: ownerId,
        accountId: pending.accountId,
        originalName: pending.originalName,
        amount: pending.amount,
        status: TransactionStatus.POSTED,
        postedAt: new Date("2026-07-16T08:00:00.000Z"),
        pendingTransactionId: pending.id,
      },
    });

    expect(posted.pendingTransactionId).toBe(pending.id);
    expect(
      await prisma.transaction.findUniqueOrThrow({ where: { id: pending.id } }),
    ).toMatchObject({ status: TransactionStatus.PENDING });
  });
});
