import {
  AccountSource,
  AccountType,
  CalendarAmountSource,
  CalendarDateSource,
  CalendarEventStatus,
  CalendarEventType,
  ConfidenceLevel,
  ConnectionStatus,
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

export async function seedDevelopmentData(
  client: PrismaClient = prisma,
  referenceDate = new Date(),
) {
  const today = new Date(
    Date.UTC(
      referenceDate.getUTCFullYear(),
      referenceDate.getUTCMonth(),
      referenceDate.getUTCDate(),
    ),
  );
  const monthStart = new Date(
    Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), 1),
  );
  const day = (offset: number) => {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() + offset);
    return date;
  };
  const currentMonthDay = (daysAgo: number, minute = 0) => {
    const date = day(-daysAgo);
    const safeDate = date < monthStart ? new Date(monthStart) : date;
    safeDate.setUTCMinutes(minute);
    return safeDate;
  };

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
      update: {
        userId: owner.id,
        status: DataSourceStatus.ACTIVE,
        lastUpdatedAt: new Date(referenceDate.getTime() - 60 * 60 * 1000),
      },
      create: {
        id: "seed_source_plaid",
        userId: owner.id,
        sourceType: DataSourceType.PLAID,
        displayName: "Synthetic Bank Sync",
        status: DataSourceStatus.ACTIVE,
        lastUpdatedAt: new Date(referenceDate.getTime() - 60 * 60 * 1000),
      },
    });
    const fidelitySource = await tx.dataSource.upsert({
      where: { id: "seed_source_fidelity" },
      update: {
        userId: owner.id,
        status: DataSourceStatus.ACTIVE,
        lastUpdatedAt: day(-2),
      },
      create: {
        id: "seed_source_fidelity",
        userId: owner.id,
        sourceType: DataSourceType.FIDELITY_IMPORT,
        displayName: "Synthetic Fidelity Import",
        status: DataSourceStatus.ACTIVE,
        lastUpdatedAt: day(-2),
      },
    });
    const manualSource = await tx.dataSource.upsert({
      where: { id: "seed_source_manual" },
      update: {
        userId: owner.id,
        status: DataSourceStatus.ACTIVE,
        lastUpdatedAt: day(-10),
      },
      create: {
        id: "seed_source_manual",
        userId: owner.id,
        sourceType: DataSourceType.MANUAL,
        displayName: "Synthetic Manual Records",
        status: DataSourceStatus.ACTIVE,
        lastUpdatedAt: day(-10),
      },
    });

    const connection = await tx.institutionConnection.upsert({
      where: { id: "seed_connection_bank" },
      update: {
        userId: owner.id,
        dataSourceId: plaidSource.id,
        status: ConnectionStatus.ACTIVE,
        lastSuccessfulSyncAt: new Date(
          referenceDate.getTime() - 60 * 60 * 1000,
        ),
      },
      create: {
        id: "seed_connection_bank",
        userId: owner.id,
        dataSourceId: plaidSource.id,
        provider: "synthetic-provider",
        providerItemId: "synthetic-item-001",
        institutionId: "synthetic-bank-001",
        institutionName: "Example Test Bank",
        lastSuccessfulSyncAt: new Date(
          referenceDate.getTime() - 60 * 60 * 1000,
        ),
      },
    });

    const account = (data: Prisma.AccountUncheckedCreateInput) => {
      const { id, ...update } = data;
      return tx.account.upsert({
        where: { id: data.id as string },
        update,
        create: data,
      });
    };
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
      lastSyncedAt: new Date(referenceDate.getTime() - 60 * 60 * 1000),
    });
    const savings = await account({
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
      lastSyncedAt: new Date(referenceDate.getTime() - 60 * 60 * 1000),
    });
    const credit = await account({
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
      lastSyncedAt: new Date(referenceDate.getTime() - 60 * 60 * 1000),
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
      lastImportedAt: day(-2),
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
      update: {
        userId: owner.id,
        accountId: checking.id,
        postedAt: currentMonthDay(3),
      },
      create: {
        id: "seed_transaction_posted",
        userId: owner.id,
        accountId: checking.id,
        providerTransactionId: "synthetic-transaction-posted-001",
        originalName: "SYNTHETIC ELECTRIC SERVICE WEB",
        merchantName: "Example Electric",
        amount: money("118.4321"),
        postedAt: currentMonthDay(3),
        status: TransactionStatus.POSTED,
        providerCategory: "Utilities",
        providerCategoryConfidence: money("0.9400"),
        rawProviderPayload: { synthetic: true, source: "test fixture" },
      },
    });
    await tx.transaction.upsert({
      where: { id: "seed_transaction_pending" },
      update: {
        userId: owner.id,
        accountId: checking.id,
        authorizedAt: new Date(referenceDate.getTime() - 30 * 60 * 1000),
      },
      create: {
        id: "seed_transaction_pending",
        userId: owner.id,
        accountId: checking.id,
        providerTransactionId: "synthetic-transaction-pending-001",
        originalName: "SYNTHETIC CORNER MARKET",
        merchantName: "Example Market",
        amount: money("42.1000"),
        authorizedAt: new Date(referenceDate.getTime() - 30 * 60 * 1000),
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

    const classifiedTransaction = async ({
      transaction,
      role,
      category,
      excluded = false,
    }: {
      transaction: Prisma.TransactionUncheckedCreateInput;
      role: FinancialRole;
      category: string;
      excluded?: boolean;
    }) => {
      const { id, ...update } = transaction;
      const record = await tx.transaction.upsert({
        where: { id: id as string },
        update,
        create: transaction,
      });
      await tx.transactionOverride.upsert({
        where: { transactionId: record.id },
        update: {
          userId: owner.id,
          categoryOverride: category,
          financialRoleOverride: role,
          excludedFromReports: excluded,
        },
        create: {
          id: `${record.id}_override`,
          userId: owner.id,
          transactionId: record.id,
          categoryOverride: category,
          financialRoleOverride: role,
          excludedFromReports: excluded,
        },
      });
      return record;
    };

    await classifiedTransaction({
      transaction: {
        id: "seed_transaction_income",
        userId: owner.id,
        accountId: checking.id,
        providerTransactionId: "synthetic-income-001",
        originalName: "SYNTHETIC EMPLOYER PAYROLL",
        merchantName: "Example Employer",
        amount: money("4250.0000"),
        postedAt: currentMonthDay(8, 1),
        status: TransactionStatus.POSTED,
        providerCategory: "Deposit",
      },
      role: FinancialRole.INCOME,
      category: "Paycheck",
    });
    await classifiedTransaction({
      transaction: {
        id: "seed_transaction_groceries",
        userId: owner.id,
        accountId: credit.id,
        providerTransactionId: "synthetic-groceries-001",
        originalName: "SYNTHETIC NEIGHBORHOOD GROCER",
        merchantName: "Example Grocer",
        amount: money("186.4200"),
        postedAt: currentMonthDay(5, 2),
        status: TransactionStatus.POSTED,
        providerCategory: "Food and Drink",
      },
      role: FinancialRole.EXPENSE,
      category: "Groceries",
    });
    await classifiedTransaction({
      transaction: {
        id: "seed_transaction_dining",
        userId: owner.id,
        accountId: credit.id,
        providerTransactionId: "synthetic-dining-001",
        originalName: "SYNTHETIC CAFE PURCHASE",
        merchantName: "Example Cafe",
        amount: money("64.7500"),
        postedAt: currentMonthDay(2, 3),
        status: TransactionStatus.POSTED,
        providerCategory: "Food and Drink",
      },
      role: FinancialRole.EXPENSE,
      category: "Dining",
    });
    await classifiedTransaction({
      transaction: {
        id: "seed_transaction_transfer",
        userId: owner.id,
        accountId: checking.id,
        providerTransactionId: "synthetic-transfer-001",
        originalName: "SYNTHETIC TRANSFER TO SAVINGS",
        merchantName: "Internal Transfer",
        amount: money("500.0000"),
        postedAt: currentMonthDay(4, 4),
        status: TransactionStatus.POSTED,
        providerCategory: "Transfer",
      },
      role: FinancialRole.TRANSFER,
      category: "Transfer",
    });
    await classifiedTransaction({
      transaction: {
        id: "seed_transaction_card_payment",
        userId: owner.id,
        accountId: checking.id,
        providerTransactionId: "synthetic-card-payment-001",
        originalName: "SYNTHETIC CREDIT CARD PAYMENT",
        merchantName: "Example Test Bank Card",
        amount: money("800.0000"),
        postedAt: currentMonthDay(6, 5),
        status: TransactionStatus.POSTED,
        providerCategory: "Payment",
      },
      role: FinancialRole.CREDIT_CARD_PAYMENT,
      category: "Credit Card Payment",
    });
    await classifiedTransaction({
      transaction: {
        id: "seed_transaction_refund",
        userId: owner.id,
        accountId: credit.id,
        providerTransactionId: "synthetic-refund-001",
        originalName: "SYNTHETIC GROCER REFUND",
        merchantName: "Example Grocer",
        amount: money("25.0000"),
        postedAt: currentMonthDay(1, 6),
        status: TransactionStatus.POSTED,
        providerCategory: "Refund",
      },
      role: FinancialRole.REFUND,
      category: "Groceries",
    });
    await classifiedTransaction({
      transaction: {
        id: "seed_transaction_excluded",
        userId: owner.id,
        accountId: checking.id,
        providerTransactionId: "synthetic-excluded-001",
        originalName: "SYNTHETIC REIMBURSABLE PURCHASE",
        merchantName: "Example Office Supply",
        amount: money("95.0000"),
        postedAt: currentMonthDay(2, 7),
        status: TransactionStatus.POSTED,
        providerCategory: "Office",
      },
      role: FinancialRole.EXPENSE,
      category: "Reimbursable",
      excluded: true,
    });

    const stream = await tx.recurringStream.upsert({
      where: { id: "seed_recurring_utility" },
      update: {
        userId: owner.id,
        typicalAccountId: checking.id,
        firstDate: day(-120),
        lastDate: day(-3),
        predictedNextDate: day(3),
        predictedPostingDate: day(3),
      },
      create: {
        id: "seed_recurring_utility",
        userId: owner.id,
        merchantName: "Example Electric",
        description: "Synthetic monthly electric bill",
        flowType: RecurringFlowType.BILL,
        frequency: RecurringFrequency.MONTHLY,
        averageAmount: money("115.5000"),
        lastAmount: money("118.4321"),
        firstDate: day(-120),
        lastDate: day(-3),
        predictedNextDate: day(3),
        predictedPostingDate: day(3),
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
      update: {
        userId: owner.id,
        recurringStreamId: stream.id,
        eventDate: day(3),
        predictedPostingDate: day(3),
        status: CalendarEventStatus.PREDICTED,
        isUserConfirmed: false,
      },
      create: {
        id: "seed_calendar_predicted",
        userId: owner.id,
        recurringStreamId: stream.id,
        accountId: checking.id,
        eventType: CalendarEventType.BILL,
        title: "Example Electric (predicted)",
        eventDate: day(3),
        predictedPostingDate: day(3),
        expectedAmount: money("115.5000"),
        dateSource: CalendarDateSource.INFERRED,
        amountSource: CalendarAmountSource.ESTIMATED,
        confidenceLevel: ConfidenceLevel.HIGH,
        status: CalendarEventStatus.PREDICTED,
      },
    });
    await tx.calendarEvent.upsert({
      where: { id: "seed_calendar_confirmed" },
      update: {
        userId: owner.id,
        recurringStreamId: stream.id,
        eventDate: day(7),
        predictedPostingDate: day(8),
        status: CalendarEventStatus.CONFIRMED,
        isUserConfirmed: true,
      },
      create: {
        id: "seed_calendar_confirmed",
        userId: owner.id,
        recurringStreamId: stream.id,
        accountId: checking.id,
        eventType: CalendarEventType.BILL,
        title: "Example Electric (confirmed)",
        eventDate: day(7),
        predictedPostingDate: day(8),
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
      update: { userId: owner.id, accountId: brokerage.id, asOfDate: day(0) },
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
        asOfDate: day(0),
      },
    });
    await tx.investmentHolding.upsert({
      where: { id: "seed_holding_manual" },
      update: { userId: owner.id, accountId: retirement.id, asOfDate: day(0) },
      create: {
        id: "seed_holding_manual",
        userId: owner.id,
        accountId: retirement.id,
        source: InvestmentSource.MANUAL,
        securityName: "Synthetic Target Date Fund",
        securityType: "retirement fund",
        currentValue: money("61500.2500"),
        vestedValue: money("60000.2500"),
        asOfDate: day(0),
      },
    });
    await tx.investmentBalanceSnapshot.upsert({
      where: { id: "seed_investment_snapshot" },
      update: {
        userId: owner.id,
        totalValue: money("28450.7700"),
        asOfDate: day(0),
      },
      create: {
        id: "seed_investment_snapshot",
        userId: owner.id,
        accountId: brokerage.id,
        totalValue: money("28450.7700"),
        source: InvestmentSource.IMPORTED,
        asOfDate: day(0),
        notes: "Synthetic Fidelity-style positions import.",
      },
    });
    await tx.investmentBalanceSnapshot.upsert({
      where: { id: "seed_investment_snapshot_401k" },
      update: {
        userId: owner.id,
        accountId: retirement.id,
        totalValue: money("61500.2500"),
        vestedValue: money("60000.2500"),
        asOfDate: day(0),
      },
      create: {
        id: "seed_investment_snapshot_401k",
        userId: owner.id,
        accountId: retirement.id,
        totalValue: money("61500.2500"),
        vestedValue: money("60000.2500"),
        source: InvestmentSource.MANUAL,
        asOfDate: day(0),
        notes: "Synthetic manual retirement balance.",
      },
    });

    const historyOffsets = [-30, -25, -20, -15, -10, -5];
    for (const [index, offset] of historyOffsets.entries()) {
      const asOfDate = day(offset);
      await tx.investmentBalanceSnapshot.upsert({
        where: { id: `seed_investment_brokerage_history_${index}` },
        update: {
          userId: owner.id,
          accountId: brokerage.id,
          totalValue: money("27000.0000").plus(index * 240),
          asOfDate,
        },
        create: {
          id: `seed_investment_brokerage_history_${index}`,
          userId: owner.id,
          accountId: brokerage.id,
          totalValue: money("27000.0000").plus(index * 240),
          source: InvestmentSource.IMPORTED,
          asOfDate,
          notes: "Synthetic historical imported balance.",
        },
      });
      await tx.investmentBalanceSnapshot.upsert({
        where: { id: `seed_investment_401k_history_${index}` },
        update: {
          userId: owner.id,
          accountId: retirement.id,
          totalValue: money("59000.0000").plus(index * 410),
          asOfDate,
        },
        create: {
          id: `seed_investment_401k_history_${index}`,
          userId: owner.id,
          accountId: retirement.id,
          totalValue: money("59000.0000").plus(index * 410),
          source: InvestmentSource.MANUAL,
          asOfDate,
          notes: "Synthetic historical manual retirement balance.",
        },
      });
    }

    await tx.manualAsset.upsert({
      where: { id: "seed_manual_home" },
      update: { userId: owner.id, currentValue: money("450000.0000") },
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
      update: { userId: owner.id, currentValue: money("275000.0000") },
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
      where: { id: "seed_balance_snapshot" },
      update: {
        userId: owner.id,
        currentBalance: money("4321.9876"),
        availableBalance: money("4200.1200"),
        capturedAt: day(0),
      },
      create: {
        id: "seed_balance_snapshot",
        userId: owner.id,
        accountId: checking.id,
        currentBalance: money("4321.9876"),
        availableBalance: money("4200.1200"),
        capturedAt: day(0),
      },
    });
    for (const [index, offset] of historyOffsets.entries()) {
      const capturedAt = day(offset);
      const snapshots = [
        {
          id: `seed_balance_checking_history_${index}`,
          accountId: checking.id,
          currentBalance: money("3900.0000").plus(index * 70),
          availableBalance: money("3800.0000").plus(index * 65),
        },
        {
          id: `seed_balance_savings_history_${index}`,
          accountId: savings.id,
          currentBalance: money("11800.0000").plus(index * 115),
          availableBalance: money("11800.0000").plus(index * 115),
        },
        {
          id: `seed_balance_credit_history_${index}`,
          accountId: credit.id,
          currentBalance: money("1100.0000").minus(index * 45),
          availableBalance: null,
        },
      ];
      for (const snapshot of snapshots) {
        await tx.balanceSnapshot.upsert({
          where: { id: snapshot.id },
          update: {
            userId: owner.id,
            accountId: snapshot.accountId,
            currentBalance: snapshot.currentBalance,
            availableBalance: snapshot.availableBalance,
            capturedAt,
          },
          create: {
            ...snapshot,
            userId: owner.id,
            capturedAt,
          },
        });
      }
    }
    await tx.balanceSnapshot.upsert({
      where: { id: "seed_balance_savings_current" },
      update: {
        userId: owner.id,
        accountId: savings.id,
        currentBalance: money("12500.0000"),
        availableBalance: money("12500.0000"),
        capturedAt: day(0),
      },
      create: {
        id: "seed_balance_savings_current",
        userId: owner.id,
        accountId: savings.id,
        currentBalance: money("12500.0000"),
        availableBalance: money("12500.0000"),
        capturedAt: day(0),
      },
    });
    await tx.balanceSnapshot.upsert({
      where: { id: "seed_balance_credit_current" },
      update: {
        userId: owner.id,
        accountId: credit.id,
        currentBalance: money("842.1500"),
        capturedAt: day(0),
      },
      create: {
        id: "seed_balance_credit_current",
        userId: owner.id,
        accountId: credit.id,
        currentBalance: money("842.1500"),
        capturedAt: day(0),
      },
    });
    await tx.importJob.upsert({
      where: { id: "seed_import_job" },
      update: {
        userId: owner.id,
        dataSourceId: fidelitySource.id,
        status: ImportStatus.COMPLETED,
        importedRowCount: 2,
        rejectedRowCount: 0,
        completedAt: day(-2),
      },
      create: {
        id: "seed_import_job",
        userId: owner.id,
        dataSourceId: fidelitySource.id,
        sourceName: "synthetic-fidelity-positions.csv",
        importType: ImportType.FIDELITY_POSITIONS_CSV,
        status: ImportStatus.COMPLETED,
        importedRowCount: 2,
        rejectedRowCount: 0,
        completedAt: day(-2),
      },
    });

    return { ownerId: owner.id };
  });
}

if (process.env.NODE_ENV !== "test") {
  seedDevelopmentData()
    .then(({ ownerId }) => {
      console.log(
        `Synthetic Milestone 3 dashboard data seeded for owner ${ownerId}.`,
      );
    })
    .finally(() => prisma.$disconnect());
}
