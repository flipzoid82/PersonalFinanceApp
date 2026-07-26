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
  const monthDay = (monthOffset: number, requestedDay: number) => {
    const first = new Date(
      Date.UTC(
        referenceDate.getUTCFullYear(),
        referenceDate.getUTCMonth() + monthOffset,
        1,
      ),
    );
    const lastDay = new Date(
      Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
    ).getUTCDate();
    first.setUTCDate(Math.min(requestedDay, lastDay));
    return first;
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
        status: DataSourceStatus.NEEDS_ATTENTION,
        lastUpdatedAt: day(-10),
      },
      create: {
        id: "seed_source_manual",
        userId: owner.id,
        sourceType: DataSourceType.MANUAL,
        displayName: "Synthetic Manual Records",
        status: DataSourceStatus.NEEDS_ATTENTION,
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
      notes: "Synthetic manual retirement account.",
    });
    const fidelityTod = await account({
      id: "seed_account_fidelity_tod",
      userId: owner.id,
      dataSourceId: manualSource.id,
      name: "Fidelity Individual TOD",
      institutionName: "Fidelity Investments",
      accountType: AccountType.BROKERAGE,
      accountSubtype: "Taxable brokerage — individual TOD",
      source: AccountSource.MANUAL,
      currentBalance: money("18750.4321"),
      isManual: true,
      isActive: true,
      notes:
        "Synthetic metadata-only Fidelity template; no credentials or sync.",
    });
    const unitedHealthContribution = await account({
      id: "seed_account_unitedhealth_contribution",
      userId: owner.id,
      dataSourceId: manualSource.id,
      name: "UnitedHealth Contribution",
      institutionName: "Fidelity NetBenefits",
      accountType: AccountType.RETIREMENT,
      accountSubtype: "Employer contribution retirement account",
      source: AccountSource.MANUAL,
      currentBalance: money("9400.1250"),
      isManual: true,
      isActive: true,
      notes: "Synthetic stale manual template account.",
    });
    const unitedHealth401k = await account({
      id: "seed_account_unitedhealth_401k",
      userId: owner.id,
      dataSourceId: manualSource.id,
      name: "UnitedHealth Group 401(k) Savings Plan",
      institutionName: "Fidelity NetBenefits",
      accountType: AccountType.FOUR_O_ONE_K,
      accountSubtype: "401(k) savings plan",
      source: AccountSource.MANUAL,
      currentBalance: money("73250.8750"),
      isManual: true,
      isActive: true,
      notes:
        "Synthetic metadata-only Fidelity template; automatic sync is unavailable.",
    });
    await account({
      id: "seed_account_inactive_manual_brokerage",
      userId: owner.id,
      dataSourceId: manualSource.id,
      name: "Archived Synthetic Brokerage",
      institutionName: "Example Manual Brokerage",
      accountType: AccountType.BROKERAGE,
      accountSubtype: "Taxable brokerage",
      source: AccountSource.MANUAL,
      currentBalance: money("2222.2222"),
      isManual: true,
      isActive: false,
      notes: "Synthetic inactive account excluded from totals.",
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

    const detectionTransaction = async (
      id: string,
      values: {
        merchant: string;
        amount: string;
        postedAt: Date | null;
        status?: TransactionStatus;
        category: string;
        accountId?: string;
      },
    ) =>
      tx.transaction.upsert({
        where: { id },
        update: {
          userId: owner.id,
          accountId: values.accountId ?? checking.id,
          originalName: `${values.merchant.toUpperCase()} SYNTHETIC`,
          merchantName: values.merchant,
          amount: money(values.amount),
          postedAt: values.postedAt,
          status: values.status ?? TransactionStatus.POSTED,
          providerCategory: values.category,
          removedAt: null,
        },
        create: {
          id,
          userId: owner.id,
          accountId: values.accountId ?? checking.id,
          originalName: `${values.merchant.toUpperCase()} SYNTHETIC`,
          merchantName: values.merchant,
          amount: money(values.amount),
          currency: "USD",
          postedAt: values.postedAt,
          status: values.status ?? TransactionStatus.POSTED,
          providerCategory: values.category,
        },
      });

    for (const [index, offset] of [-3, -2, -1].entries()) {
      await detectionTransaction(`seed_detection_fixed_${index}`, {
        merchant: "Example Cloud Storage",
        amount: "19.9900",
        postedAt: monthDay(offset, 5),
        category: "ENTERTAINMENT_SUBSCRIPTION",
      });
      await detectionTransaction(`seed_detection_variable_${index}`, {
        merchant: "Example Water Utility",
        amount: ["72.1500", "91.8400", "83.2200"][index],
        postedAt: monthDay(offset, 12),
        category: "RENT_AND_UTILITIES_WATER",
      });
    }
    for (const [index, offset] of [-42, -28, -14].entries()) {
      await detectionTransaction(`seed_detection_income_${index}`, {
        merchant: "Example Biweekly Employer",
        amount: "2100.0000",
        postedAt: day(offset),
        category: "INCOME_WAGES",
      });
    }
    for (const [index, offset] of [-2, -1].entries()) {
      await detectionTransaction(`seed_detection_lookalike_${index}`, {
        merchant: "Example Nonrecurring Lookalike",
        amount: "44.0000",
        postedAt: monthDay(offset, 20),
        category: "GENERAL_MERCHANDISE_OTHER_GENERAL_MERCHANDISE",
      });
    }
    await detectionTransaction("seed_detection_pending", {
      merchant: "Example Cloud Storage",
      amount: "19.9900",
      postedAt: null,
      status: TransactionStatus.PENDING,
      category: "ENTERTAINMENT_SUBSCRIPTION",
    });

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

    const highMatchTransaction = await classifiedTransaction({
      transaction: {
        id: "seed_transaction_calendar_high_match",
        userId: owner.id,
        accountId: checking.id,
        providerTransactionId: "synthetic-calendar-high-match-001",
        originalName: "SYNTHETIC INTERNET SERVICE",
        merchantName: "Example Internet",
        amount: money("79.9900"),
        postedAt: day(0),
        status: TransactionStatus.POSTED,
        providerCategory: "Utilities",
      },
      role: FinancialRole.EXPENSE,
      category: "Home Utilities",
      excluded: true,
    });
    const paidTransaction = await classifiedTransaction({
      transaction: {
        id: "seed_transaction_calendar_paid",
        userId: owner.id,
        accountId: credit.id,
        providerTransactionId: "synthetic-calendar-paid-001",
        originalName: "SYNTHETIC VIDEO STREAMING",
        merchantName: "Example Video",
        amount: money("14.9900"),
        postedAt: day(-2),
        status: TransactionStatus.POSTED,
        providerCategory: "Entertainment",
      },
      role: FinancialRole.EXPENSE,
      category: "Subscriptions",
      excluded: true,
    });
    await tx.transaction.upsert({
      where: { id: "seed_transaction_calendar_low_match" },
      update: {
        userId: owner.id,
        accountId: credit.id,
        postedAt: day(0),
        status: TransactionStatus.POSTED,
      },
      create: {
        id: "seed_transaction_calendar_low_match",
        userId: owner.id,
        accountId: credit.id,
        providerTransactionId: "synthetic-calendar-low-match-001",
        originalName: "SYNTHETIC INSURANCE CHARGE",
        merchantName: "Example Insurance",
        amount: money("101.2500"),
        postedAt: day(0),
        status: TransactionStatus.POSTED,
      },
    });

    const recurring = async (
      id: string,
      values: {
        name: string;
        flowType: RecurringFlowType;
        frequency?: RecurringFrequency;
        amount: string;
        date: Date;
        postingDate?: Date | null;
        dueDate?: Date | null;
        confidence: ConfidenceLevel;
        status?: RecurringStatus;
        accountId?: string | null;
        active?: boolean;
      },
    ) => {
      const data = {
        userId: owner.id,
        merchantName: values.name,
        description: `Synthetic recurring stream for ${values.name}`,
        flowType: values.flowType,
        frequency: values.frequency ?? RecurringFrequency.MONTHLY,
        averageAmount: money(values.amount),
        lastAmount: money(values.amount),
        firstDate: day(-180),
        lastDate: day(-30),
        predictedNextDate: values.date,
        predictedPostingDate: values.postingDate ?? values.date,
        confirmedDueDate: values.dueDate ?? null,
        dateSource: values.dueDate
          ? CalendarDateSource.USER_CONFIRMED
          : CalendarDateSource.INFERRED,
        confidenceLevel: values.confidence,
        confidenceScore:
          values.confidence === ConfidenceLevel.HIGH
            ? money("0.9500")
            : values.confidence === ConfidenceLevel.MEDIUM
              ? money("0.7000")
              : values.confidence === ConfidenceLevel.LOW
                ? money("0.4200")
                : null,
        isActive: values.active ?? true,
        status: values.status ?? RecurringStatus.ACTIVE,
        category: values.flowType.toLowerCase().replaceAll("_", " "),
        typicalAccountId: values.accountId ?? checking.id,
      };
      return tx.recurringStream.upsert({
        where: { id },
        update: data,
        create: { id, ...data },
      });
    };
    const occurrence = async (
      id: string,
      values: {
        streamId: string;
        title: string;
        type: CalendarEventType;
        date: Date;
        amount?: string | null;
        amountSource?: CalendarAmountSource;
        postingDate?: Date | null;
        dateSource?: CalendarDateSource;
        confidence: ConfidenceLevel;
        status: CalendarEventStatus;
        accountId?: string | null;
        confirmed?: boolean;
        linkedTransactionId?: string | null;
        actualAmount?: string | null;
        notes?: string;
      },
    ) => {
      const data = {
        userId: owner.id,
        recurringStreamId: values.streamId,
        accountId:
          values.accountId === undefined ? checking.id : values.accountId,
        linkedTransactionId: values.linkedTransactionId ?? null,
        eventType: values.type,
        title: values.title,
        eventDate: values.date,
        predictedPostingDate: values.postingDate ?? values.date,
        expectedAmount:
          values.amount === null ? null : money(values.amount ?? "0.0000"),
        actualAmount: values.actualAmount ? money(values.actualAmount) : null,
        dateSource: values.dateSource ?? CalendarDateSource.INFERRED,
        amountSource: values.amountSource ?? CalendarAmountSource.FIXED,
        confidenceLevel: values.confidence,
        status: values.status,
        isUserConfirmed: values.confirmed ?? false,
        notes: values.notes ?? null,
      };
      return tx.calendarEvent.upsert({
        where: { id },
        update: data,
        create: { id, ...data },
      });
    };

    const subscriptionStream = await recurring("seed_recurring_subscription", {
      name: "Example Music",
      flowType: RecurringFlowType.SUBSCRIPTION,
      amount: "12.9900",
      date: day(5),
      confidence: ConfidenceLevel.MEDIUM,
      accountId: credit.id,
    });
    await occurrence("seed_calendar_subscription", {
      streamId: subscriptionStream.id,
      title: "Example Music subscription",
      type: CalendarEventType.SUBSCRIPTION,
      date: day(5),
      amount: "12.9900",
      amountSource: CalendarAmountSource.LAST_OBSERVED,
      confidence: ConfidenceLevel.MEDIUM,
      status: CalendarEventStatus.PREDICTED,
      accountId: credit.id,
    });

    const debtStream = await recurring("seed_recurring_debt", {
      name: "Example Auto Loan",
      flowType: RecurringFlowType.DEBT_PAYMENT,
      amount: "325.0000",
      date: day(10),
      dueDate: day(10),
      postingDate: day(11),
      confidence: ConfidenceLevel.HIGH,
    });
    await occurrence("seed_calendar_debt", {
      streamId: debtStream.id,
      title: "Example auto loan payment",
      type: CalendarEventType.DEBT_PAYMENT,
      date: day(10),
      postingDate: day(11),
      amount: "325.0000",
      confidence: ConfidenceLevel.HIGH,
      status: CalendarEventStatus.CONFIRMED,
      dateSource: CalendarDateSource.USER_CONFIRMED,
      confirmed: true,
    });

    const cardStream = await recurring("seed_recurring_card_payment", {
      name: "Example Rewards Card",
      flowType: RecurringFlowType.CREDIT_CARD_PAYMENT,
      amount: "800.0000",
      date: day(12),
      dueDate: day(12),
      confidence: ConfidenceLevel.MEDIUM,
    });
    await occurrence("seed_calendar_card_payment", {
      streamId: cardStream.id,
      title: "Example credit-card payment",
      type: CalendarEventType.CREDIT_CARD_PAYMENT,
      date: day(12),
      amount: "800.0000",
      confidence: ConfidenceLevel.MEDIUM,
      status: CalendarEventStatus.CONFIRMED,
      dateSource: CalendarDateSource.USER_CONFIRMED,
      confirmed: true,
    });

    const incomeStream = await recurring("seed_recurring_income", {
      name: "Example Employer",
      flowType: RecurringFlowType.EXPECTED_INCOME,
      frequency: RecurringFrequency.BIWEEKLY,
      amount: "4250.0000",
      date: day(5),
      dueDate: day(5),
      confidence: ConfidenceLevel.HIGH,
    });
    await occurrence("seed_calendar_income", {
      streamId: incomeStream.id,
      title: "Expected synthetic paycheck",
      type: CalendarEventType.EXPECTED_INCOME,
      date: day(5),
      amount: "4250.0000",
      confidence: ConfidenceLevel.HIGH,
      status: CalendarEventStatus.CONFIRMED,
      dateSource: CalendarDateSource.USER_CONFIRMED,
      confirmed: true,
    });

    const needsStream = await recurring("seed_recurring_needs_confirmation", {
      name: "Example Insurance Premium",
      flowType: RecurringFlowType.BILL,
      amount: "100.0000",
      date: day(5),
      confidence: ConfidenceLevel.NEEDS_CONFIRMATION,
      status: RecurringStatus.NEEDS_CONFIRMATION,
    });
    await occurrence("seed_calendar_needs_confirmation", {
      streamId: needsStream.id,
      title: "Possible insurance premium",
      type: CalendarEventType.BILL,
      date: day(5),
      amount: "100.0000",
      amountSource: CalendarAmountSource.ESTIMATED,
      confidence: ConfidenceLevel.NEEDS_CONFIRMATION,
      status: CalendarEventStatus.NEEDS_CONFIRMATION,
    });

    const paidStream = await recurring("seed_recurring_paid", {
      name: "Example Video",
      flowType: RecurringFlowType.SUBSCRIPTION,
      amount: "14.9900",
      date: day(-2),
      confidence: ConfidenceLevel.HIGH,
      accountId: credit.id,
    });
    await occurrence("seed_calendar_paid", {
      streamId: paidStream.id,
      title: "Example Video subscription",
      type: CalendarEventType.SUBSCRIPTION,
      date: day(-2),
      amount: "14.9900",
      confidence: ConfidenceLevel.HIGH,
      status: CalendarEventStatus.PAID,
      accountId: credit.id,
      linkedTransactionId: paidTransaction.id,
      actualAmount: "14.9900",
    });

    const skippedStream = await recurring("seed_recurring_skipped", {
      name: "Example Lawn Service",
      flowType: RecurringFlowType.BILL,
      amount: "55.0000",
      date: day(9),
      dueDate: day(9),
      confidence: ConfidenceLevel.MEDIUM,
    });
    await occurrence("seed_calendar_skipped", {
      streamId: skippedStream.id,
      title: "Example lawn service",
      type: CalendarEventType.BILL,
      date: day(9),
      amount: "55.0000",
      confidence: ConfidenceLevel.MEDIUM,
      status: CalendarEventStatus.SKIPPED,
      dateSource: CalendarDateSource.USER_CONFIRMED,
      confirmed: true,
    });

    const inactiveStream = await recurring("seed_recurring_inactive", {
      name: "Example Archived Service",
      flowType: RecurringFlowType.SUBSCRIPTION,
      amount: "8.0000",
      date: day(11),
      confidence: ConfidenceLevel.LOW,
      active: false,
      status: RecurringStatus.INACTIVE,
    });
    await occurrence("seed_calendar_inactive", {
      streamId: inactiveStream.id,
      title: "Example archived subscription",
      type: CalendarEventType.SUBSCRIPTION,
      date: day(11),
      amount: "8.0000",
      confidence: ConfidenceLevel.LOW,
      status: CalendarEventStatus.INACTIVE,
    });

    const manualStream = await recurring("seed_recurring_manual", {
      name: "Manual club dues",
      flowType: RecurringFlowType.OTHER,
      frequency: RecurringFrequency.QUARTERLY,
      amount: "45.0000",
      date: day(13),
      dueDate: day(13),
      confidence: ConfidenceLevel.HIGH,
      accountId: null,
    });
    await occurrence("seed_calendar_manual", {
      streamId: manualStream.id,
      title: "Manual club dues",
      type: CalendarEventType.OTHER_RECURRING,
      date: day(13),
      postingDate: null,
      amount: "45.0000",
      amountSource: CalendarAmountSource.MANUAL,
      dateSource: CalendarDateSource.MANUAL,
      confidence: ConfidenceLevel.HIGH,
      status: CalendarEventStatus.CONFIRMED,
      accountId: null,
      confirmed: true,
      notes: "Clearly labeled synthetic manual event.",
    });

    const matchStream = await recurring("seed_recurring_high_match", {
      name: "Example Internet",
      flowType: RecurringFlowType.BILL,
      amount: "79.9900",
      date: day(2),
      confidence: ConfidenceLevel.HIGH,
    });
    await occurrence("seed_calendar_high_match", {
      streamId: matchStream.id,
      title: "Example Internet bill",
      type: CalendarEventType.BILL,
      date: day(2),
      amount: "79.9900",
      confidence: ConfidenceLevel.HIGH,
      status: CalendarEventStatus.PREDICTED,
      notes: `Suggested posted transaction ${highMatchTransaction.id} is not accepted until the owner acts.`,
    });

    const monthBoundary = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0),
    );
    const boundaryStream = await recurring("seed_recurring_month_boundary", {
      name: "Example Month-End Storage",
      flowType: RecurringFlowType.BILL,
      amount: "62.5000",
      date: monthBoundary,
      confidence: ConfidenceLevel.LOW,
    });
    await occurrence("seed_calendar_month_boundary", {
      streamId: boundaryStream.id,
      title: "Example month-end storage",
      type: CalendarEventType.BILL,
      date: monthBoundary,
      amount: "62.5000",
      amountSource: CalendarAmountSource.ESTIMATED,
      confidence: ConfidenceLevel.LOW,
      status: CalendarEventStatus.PREDICTED,
    });

    const partialStream = await recurring("seed_recurring_partial", {
      name: "Example Variable Assessment",
      flowType: RecurringFlowType.OTHER,
      amount: "1.0000",
      date: day(20),
      confidence: ConfidenceLevel.LOW,
      accountId: retirement.id,
    });
    await occurrence("seed_calendar_partial", {
      streamId: partialStream.id,
      title: "Example variable assessment",
      type: CalendarEventType.OTHER_RECURRING,
      date: day(20),
      amount: null,
      amountSource: CalendarAmountSource.ESTIMATED,
      confidence: ConfidenceLevel.LOW,
      status: CalendarEventStatus.PREDICTED,
      accountId: retirement.id,
      notes: "Amount unavailable until the next synthetic statement.",
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
      where: { id: "seed_holding_fidelity_tod" },
      update: {
        userId: owner.id,
        accountId: fidelityTod.id,
        asOfDate: day(0),
      },
      create: {
        id: "seed_holding_fidelity_tod",
        userId: owner.id,
        accountId: fidelityTod.id,
        source: InvestmentSource.MANUAL,
        securityName: "Synthetic Broad Market ETF",
        tickerSymbol: "FAKEX",
        securityType: "exchange-traded fund",
        quantity: money("75.1250000000"),
        price: money("249.5900"),
        currentValue: money("18750.4321"),
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
    const fidelitySnapshots = [
      {
        id: "seed_investment_snapshot_fidelity_tod",
        accountId: fidelityTod.id,
        totalValue: money("18750.4321"),
        vestedValue: null,
        asOfDate: day(0),
        notes: "Synthetic fresh manual Fidelity TOD balance.",
      },
      {
        id: "seed_investment_snapshot_unitedhealth_contribution",
        accountId: unitedHealthContribution.id,
        totalValue: money("9400.1250"),
        vestedValue: money("9400.1250"),
        asOfDate: day(-10),
        notes: "Synthetic stale employer contribution balance.",
      },
      {
        id: "seed_investment_snapshot_unitedhealth_401k",
        accountId: unitedHealth401k.id,
        totalValue: money("73250.8750"),
        vestedValue: money("70100.5000"),
        asOfDate: day(-1),
        notes: "Synthetic manual NetBenefits 401(k) balance.",
      },
    ];
    for (const snapshot of fidelitySnapshots) {
      await tx.investmentBalanceSnapshot.upsert({
        where: { id: snapshot.id },
        update: {
          userId: owner.id,
          accountId: snapshot.accountId,
          totalValue: snapshot.totalValue,
          vestedValue: snapshot.vestedValue,
          asOfDate: snapshot.asOfDate,
          notes: snapshot.notes,
        },
        create: {
          ...snapshot,
          userId: owner.id,
          source: InvestmentSource.MANUAL,
        },
      });
    }
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
      update: {
        userId: owner.id,
        currentValue: money("450000.0000"),
        isActive: true,
      },
      create: {
        id: "seed_manual_home",
        userId: owner.id,
        name: "Synthetic Primary Home",
        assetType: ManualAssetType.HOME,
        currentValue: money("450000.0000"),
        costBasis: money("390000.0000"),
        isDebt: false,
        isActive: true,
        notes: "Synthetic manually tracked residence.",
      },
    });
    await tx.manualAsset.upsert({
      where: { id: "seed_manual_mortgage" },
      update: {
        userId: owner.id,
        currentValue: money("275000.0000"),
        isActive: true,
      },
      create: {
        id: "seed_manual_mortgage",
        userId: owner.id,
        name: "Synthetic Mortgage",
        assetType: ManualAssetType.MORTGAGE,
        currentValue: money("275000.0000"),
        isDebt: true,
        isActive: true,
        notes: "Synthetic mortgage amount owed.",
      },
    });
    await tx.manualAsset.upsert({
      where: { id: "seed_manual_vehicle" },
      update: {
        userId: owner.id,
        currentValue: money("28500.5555"),
        isActive: true,
      },
      create: {
        id: "seed_manual_vehicle",
        userId: owner.id,
        name: "Synthetic Family Vehicle",
        assetType: ManualAssetType.VEHICLE,
        currentValue: money("28500.5555"),
        costBasis: money("36000.0000"),
        isDebt: false,
        isActive: true,
        acquiredAt: day(-365),
        notes: "Clearly fake manually tracked vehicle.",
      },
    });
    await tx.manualAsset.upsert({
      where: { id: "seed_manual_auto_loan" },
      update: {
        userId: owner.id,
        currentValue: money("14200.1111"),
        isActive: true,
      },
      create: {
        id: "seed_manual_auto_loan",
        userId: owner.id,
        name: "Synthetic Auto Loan",
        assetType: ManualAssetType.AUTO_LOAN,
        currentValue: money("14200.1111"),
        isDebt: true,
        isActive: true,
        notes: "Clearly fake auto-loan amount owed.",
      },
    });
    await tx.manualAsset.upsert({
      where: { id: "seed_manual_inactive_private_asset" },
      update: {
        userId: owner.id,
        currentValue: money("5000.0000"),
        isActive: false,
      },
      create: {
        id: "seed_manual_inactive_private_asset",
        userId: owner.id,
        name: "Archived Synthetic Collectible",
        assetType: ManualAssetType.PRIVATE_ASSET,
        currentValue: money("5000.0000"),
        isDebt: false,
        isActive: false,
        notes: "Synthetic inactive asset excluded from net worth.",
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
        `Synthetic Milestone 7 portfolio, Calendar, dashboard, and recurring-detection data seeded for owner ${ownerId}.`,
      );
    })
    .finally(() => prisma.$disconnect());
}
