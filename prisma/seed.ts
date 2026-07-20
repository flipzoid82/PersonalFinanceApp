import {
  AccountSource,
  AccountType,
  CalendarAmountSource,
  CalendarDateSource,
  CalendarEventStatus,
  CalendarEventType,
  ConfidenceLevel,
  DataSourceStatus,
  DataSourceType,
  FinancialRole,
  ImportStatus,
  ImportType,
  InvestmentSource,
  ManualAssetType,
  Prisma,
  PrismaClient,
  RecurringFlowType,
  RecurringFrequency,
  RecurringStatus,
  TransactionStatus,
} from "@prisma/client";

const prisma = new PrismaClient();
const money = (value: string) => new Prisma.Decimal(value);

export async function seedDevelopmentData(client: PrismaClient = prisma) {
  return client.$transaction(async (tx) => {
    const existingOwner = await tx.user.findFirst({
      orderBy: { createdAt: "asc" },
    });
    const owner =
      existingOwner ??
      (await tx.user.create({
        data: {
          id: "seed_owner",
          email: "seed-owner@example.test",
          displayName: "Synthetic Owner",
          // Intentionally not a valid application password hash. Use owner:create to configure login.
          passwordHash: "seed-only-login-disabled",
        },
      }));

    const plaidSource = await tx.dataSource.upsert({
      where: { id: "seed_source_plaid" },
      update: { userId: owner.id },
      create: {
        id: "seed_source_plaid",
        userId: owner.id,
        sourceType: DataSourceType.PLAID,
        displayName: "Synthetic Bank Sync",
        status: DataSourceStatus.ACTIVE,
        lastUpdatedAt: new Date("2026-07-15T12:00:00.000Z"),
      },
    });
    const fidelitySource = await tx.dataSource.upsert({
      where: { id: "seed_source_fidelity" },
      update: { userId: owner.id },
      create: {
        id: "seed_source_fidelity",
        userId: owner.id,
        sourceType: DataSourceType.FIDELITY_IMPORT,
        displayName: "Synthetic Fidelity Import",
        status: DataSourceStatus.ACTIVE,
        lastUpdatedAt: new Date("2026-07-14T12:00:00.000Z"),
      },
    });
    const manualSource = await tx.dataSource.upsert({
      where: { id: "seed_source_manual" },
      update: { userId: owner.id },
      create: {
        id: "seed_source_manual",
        userId: owner.id,
        sourceType: DataSourceType.MANUAL,
        displayName: "Synthetic Manual Records",
        status: DataSourceStatus.ACTIVE,
        lastUpdatedAt: new Date("2026-07-13T12:00:00.000Z"),
      },
    });

    const connection = await tx.institutionConnection.upsert({
      where: { id: "seed_connection_bank" },
      update: { userId: owner.id, dataSourceId: plaidSource.id },
      create: {
        id: "seed_connection_bank",
        userId: owner.id,
        dataSourceId: plaidSource.id,
        provider: "synthetic-provider",
        providerItemId: "synthetic-item-001",
        institutionId: "synthetic-bank-001",
        institutionName: "Example Test Bank",
        lastSuccessfulSyncAt: new Date("2026-07-15T12:00:00.000Z"),
      },
    });

    const account = (data: Prisma.AccountUncheckedCreateInput) =>
      tx.account.upsert({
        where: { id: data.id as string },
        update: {
          userId: data.userId,
          dataSourceId: data.dataSourceId,
          institutionConnectionId: data.institutionConnectionId,
        },
        create: data,
      });
    const checking = await account({
      id: "seed_account_checking",
      userId: owner.id,
      dataSourceId: plaidSource.id,
      institutionConnectionId: connection.id,
      providerAccountId: "synthetic-checking-001",
      name: "Everyday Checking",
      institutionName: "Example Test Bank",
      accountType: AccountType.CHECKING,
      accountSubtype: "checking",
      source: AccountSource.SYNCED,
      currentBalance: money("4321.9876"),
      availableBalance: money("4200.1200"),
      isManual: false,
      lastSyncedAt: new Date("2026-07-15T12:00:00.000Z"),
    });
    await account({
      id: "seed_account_savings",
      userId: owner.id,
      dataSourceId: plaidSource.id,
      institutionConnectionId: connection.id,
      providerAccountId: "synthetic-savings-001",
      name: "Rainy Day Savings",
      institutionName: "Example Test Bank",
      accountType: AccountType.SAVINGS,
      accountSubtype: "savings",
      source: AccountSource.SYNCED,
      currentBalance: money("12500.0000"),
      availableBalance: money("12500.0000"),
      isManual: false,
      lastSyncedAt: new Date("2026-07-15T12:00:00.000Z"),
    });
    await account({
      id: "seed_account_credit",
      userId: owner.id,
      dataSourceId: plaidSource.id,
      institutionConnectionId: connection.id,
      providerAccountId: "synthetic-credit-001",
      name: "Rewards Card",
      institutionName: "Example Test Bank",
      accountType: AccountType.CREDIT_CARD,
      accountSubtype: "credit card",
      source: AccountSource.SYNCED,
      currentBalance: money("842.1500"),
      creditLimit: money("10000.0000"),
      isManual: false,
      lastSyncedAt: new Date("2026-07-15T12:00:00.000Z"),
    });
    const brokerage = await account({
      id: "seed_account_brokerage",
      userId: owner.id,
      dataSourceId: fidelitySource.id,
      name: "Synthetic Individual Brokerage",
      institutionName: "Example Investment Firm",
      accountType: AccountType.BROKERAGE,
      accountSubtype: "individual brokerage",
      source: AccountSource.IMPORTED,
      currentBalance: money("28450.7700"),
      isManual: false,
      lastImportedAt: new Date("2026-07-14T12:00:00.000Z"),
    });
    const retirement = await account({
      id: "seed_account_401k",
      userId: owner.id,
      dataSourceId: manualSource.id,
      name: "Synthetic Employer 401(k)",
      institutionName: "Example Retirement Provider",
      accountType: AccountType.FOUR_O_ONE_K,
      accountSubtype: "401(k)",
      source: AccountSource.MANUAL,
      currentBalance: money("61500.2500"),
      isManual: true,
    });

    const posted = await tx.transaction.upsert({
      where: { id: "seed_transaction_posted" },
      update: { userId: owner.id, accountId: checking.id },
      create: {
        id: "seed_transaction_posted",
        userId: owner.id,
        accountId: checking.id,
        providerTransactionId: "synthetic-transaction-posted-001",
        originalName: "SYNTHETIC ELECTRIC SERVICE WEB",
        merchantName: "Example Electric",
        amount: money("118.4321"),
        postedAt: new Date("2026-07-10T08:00:00.000Z"),
        status: TransactionStatus.POSTED,
        providerCategory: "Utilities",
        providerCategoryConfidence: money("0.9400"),
        rawProviderPayload: { synthetic: true, source: "test fixture" },
      },
    });
    await tx.transaction.upsert({
      where: { id: "seed_transaction_pending" },
      update: { userId: owner.id, accountId: checking.id },
      create: {
        id: "seed_transaction_pending",
        userId: owner.id,
        accountId: checking.id,
        providerTransactionId: "synthetic-transaction-pending-001",
        originalName: "SYNTHETIC CORNER MARKET",
        merchantName: "Example Market",
        amount: money("42.1000"),
        authorizedAt: new Date("2026-07-15T18:30:00.000Z"),
        status: TransactionStatus.PENDING,
      },
    });
    await tx.transactionOverride.upsert({
      where: { transactionId: posted.id },
      update: { userId: owner.id },
      create: {
        id: "seed_transaction_override",
        userId: owner.id,
        transactionId: posted.id,
        merchantNameOverride: "Example Electric Utility",
        categoryOverride: "Home Utilities",
        financialRoleOverride: FinancialRole.EXPENSE,
        notes: "Synthetic correction kept separate from source data.",
      },
    });

    const stream = await tx.recurringStream.upsert({
      where: { id: "seed_recurring_utility" },
      update: { userId: owner.id, typicalAccountId: checking.id },
      create: {
        id: "seed_recurring_utility",
        userId: owner.id,
        merchantName: "Example Electric",
        description: "Synthetic monthly electric bill",
        flowType: RecurringFlowType.BILL,
        frequency: RecurringFrequency.MONTHLY,
        averageAmount: money("115.5000"),
        lastAmount: money("118.4321"),
        firstDate: new Date("2026-04-10T00:00:00.000Z"),
        lastDate: new Date("2026-07-10T00:00:00.000Z"),
        predictedNextDate: new Date("2026-08-10T00:00:00.000Z"),
        predictedPostingDate: new Date("2026-08-10T00:00:00.000Z"),
        dateSource: CalendarDateSource.INFERRED,
        confidenceLevel: ConfidenceLevel.HIGH,
        confidenceScore: money("0.9200"),
        status: RecurringStatus.ACTIVE,
        category: "Home Utilities",
        typicalAccountId: checking.id,
      },
    });
    await tx.calendarEvent.upsert({
      where: { id: "seed_calendar_predicted" },
      update: { userId: owner.id, recurringStreamId: stream.id },
      create: {
        id: "seed_calendar_predicted",
        userId: owner.id,
        recurringStreamId: stream.id,
        accountId: checking.id,
        eventType: CalendarEventType.BILL,
        title: "Example Electric (predicted)",
        eventDate: new Date("2026-08-10T00:00:00.000Z"),
        predictedPostingDate: new Date("2026-08-10T00:00:00.000Z"),
        expectedAmount: money("115.5000"),
        dateSource: CalendarDateSource.INFERRED,
        amountSource: CalendarAmountSource.ESTIMATED,
        confidenceLevel: ConfidenceLevel.HIGH,
        status: CalendarEventStatus.PREDICTED,
      },
    });
    await tx.calendarEvent.upsert({
      where: { id: "seed_calendar_confirmed" },
      update: { userId: owner.id, recurringStreamId: stream.id },
      create: {
        id: "seed_calendar_confirmed",
        userId: owner.id,
        recurringStreamId: stream.id,
        accountId: checking.id,
        eventType: CalendarEventType.BILL,
        title: "Example Electric (confirmed)",
        eventDate: new Date("2026-09-08T00:00:00.000Z"),
        predictedPostingDate: new Date("2026-09-10T00:00:00.000Z"),
        expectedAmount: money("120.0000"),
        dateSource: CalendarDateSource.USER_CONFIRMED,
        amountSource: CalendarAmountSource.FIXED,
        confidenceLevel: ConfidenceLevel.HIGH,
        status: CalendarEventStatus.CONFIRMED,
        isUserConfirmed: true,
      },
    });

    await tx.investmentHolding.upsert({
      where: { id: "seed_holding_imported" },
      update: { userId: owner.id, accountId: brokerage.id },
      create: {
        id: "seed_holding_imported",
        userId: owner.id,
        accountId: brokerage.id,
        source: InvestmentSource.IMPORTED,
        securityName: "Synthetic Total Market Fund",
        tickerSymbol: "TESTX",
        securityType: "mutual fund",
        quantity: money("125.5000000000"),
        price: money("100.2500"),
        currentValue: money("12581.3750"),
        costBasis: money("11000.0000"),
        asOfDate: new Date("2026-07-14T12:00:00.000Z"),
      },
    });
    await tx.investmentHolding.upsert({
      where: { id: "seed_holding_manual" },
      update: { userId: owner.id, accountId: retirement.id },
      create: {
        id: "seed_holding_manual",
        userId: owner.id,
        accountId: retirement.id,
        source: InvestmentSource.MANUAL,
        securityName: "Synthetic Target Date Fund",
        securityType: "retirement fund",
        currentValue: money("61500.2500"),
        vestedValue: money("60000.2500"),
        asOfDate: new Date("2026-07-13T12:00:00.000Z"),
      },
    });
    await tx.investmentBalanceSnapshot.upsert({
      where: {
        accountId_source_asOfDate: {
          accountId: brokerage.id,
          source: InvestmentSource.IMPORTED,
          asOfDate: new Date("2026-07-14T12:00:00.000Z"),
        },
      },
      update: { userId: owner.id },
      create: {
        id: "seed_investment_snapshot",
        userId: owner.id,
        accountId: brokerage.id,
        totalValue: money("28450.7700"),
        source: InvestmentSource.IMPORTED,
        asOfDate: new Date("2026-07-14T12:00:00.000Z"),
        notes: "Synthetic Fidelity-style positions import.",
      },
    });

    await tx.manualAsset.upsert({
      where: { id: "seed_manual_home" },
      update: { userId: owner.id },
      create: {
        id: "seed_manual_home",
        userId: owner.id,
        name: "Synthetic Primary Home",
        assetType: ManualAssetType.HOME,
        currentValue: money("450000.0000"),
        costBasis: money("390000.0000"),
        isDebt: false,
      },
    });
    await tx.manualAsset.upsert({
      where: { id: "seed_manual_mortgage" },
      update: { userId: owner.id },
      create: {
        id: "seed_manual_mortgage",
        userId: owner.id,
        name: "Synthetic Mortgage",
        assetType: ManualAssetType.MORTGAGE,
        currentValue: money("275000.0000"),
        isDebt: true,
      },
    });
    await tx.balanceSnapshot.upsert({
      where: {
        accountId_capturedAt: {
          accountId: checking.id,
          capturedAt: new Date("2026-07-15T12:00:00.000Z"),
        },
      },
      update: { currentBalance: money("4321.9876") },
      create: {
        id: "seed_balance_snapshot",
        userId: owner.id,
        accountId: checking.id,
        currentBalance: money("4321.9876"),
        availableBalance: money("4200.1200"),
        capturedAt: new Date("2026-07-15T12:00:00.000Z"),
      },
    });
    await tx.importJob.upsert({
      where: { id: "seed_import_job" },
      update: { userId: owner.id, dataSourceId: fidelitySource.id },
      create: {
        id: "seed_import_job",
        userId: owner.id,
        dataSourceId: fidelitySource.id,
        sourceName: "synthetic-fidelity-positions.csv",
        importType: ImportType.FIDELITY_POSITIONS_CSV,
        status: ImportStatus.COMPLETED,
        importedRowCount: 2,
        rejectedRowCount: 0,
        completedAt: new Date("2026-07-14T12:01:00.000Z"),
      },
    });

    return { ownerId: owner.id };
  });
}

if (process.env.NODE_ENV !== "test") {
  seedDevelopmentData()
    .then(({ ownerId }) => {
      console.log(`Synthetic Milestone 2 data seeded for owner ${ownerId}.`);
    })
    .finally(() => prisma.$disconnect());
}
