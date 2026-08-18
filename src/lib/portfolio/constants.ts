import {
  AccountType,
  ManualAssetType,
  type InvestmentSource,
} from "@prisma/client";

export const STALE_AFTER_DAYS = 7;

export const INVESTMENT_ACCOUNT_TYPES = new Set<AccountType>([
  AccountType.BROKERAGE,
  AccountType.RETIREMENT,
  AccountType.FOUR_O_ONE_K,
]);

export const DEBT_ACCOUNT_TYPES = new Set<AccountType>([
  AccountType.CREDIT_CARD,
  AccountType.LOAN,
  AccountType.MORTGAGE,
  AccountType.MANUAL_DEBT,
]);

export function accountTypeLabel(type: AccountType) {
  return (
    MANUAL_ACCOUNT_OPTIONS.find(({ value }) => value === type)?.label ??
    (type === AccountType.OTHER ? "Other account" : "Account")
  );
}

export const MANUAL_ACCOUNT_OPTIONS = [
  { value: AccountType.CHECKING, label: "Checking" },
  { value: AccountType.SAVINGS, label: "Savings" },
  { value: AccountType.BROKERAGE, label: "Brokerage" },
  { value: AccountType.RETIREMENT, label: "Retirement / IRA / 403(b) / HSA" },
  { value: AccountType.FOUR_O_ONE_K, label: "401(k)" },
  { value: AccountType.MORTGAGE, label: "Mortgage" },
  { value: AccountType.LOAN, label: "Loan" },
  { value: AccountType.CREDIT_CARD, label: "Credit card" },
  { value: AccountType.MANUAL_ASSET, label: "Other asset" },
  { value: AccountType.MANUAL_DEBT, label: "Other debt" },
] as const;

export const MANUAL_ASSET_OPTIONS = [
  { value: ManualAssetType.HOME, label: "Primary residence" },
  { value: ManualAssetType.OTHER_REAL_ESTATE, label: "Other real estate" },
  { value: ManualAssetType.VEHICLE, label: "Vehicle" },
  { value: ManualAssetType.PRIVATE_ASSET, label: "Private asset" },
  { value: ManualAssetType.OTHER_ASSET, label: "Other asset" },
  { value: ManualAssetType.MORTGAGE, label: "Mortgage" },
  { value: ManualAssetType.AUTO_LOAN, label: "Auto loan" },
  { value: ManualAssetType.STUDENT_LOAN, label: "Student loan" },
  { value: ManualAssetType.PERSONAL_LOAN, label: "Personal loan" },
  { value: ManualAssetType.OTHER_DEBT, label: "Other debt" },
] as const;

export const DEBT_ASSET_TYPES = new Set<ManualAssetType>([
  ManualAssetType.MORTGAGE,
  ManualAssetType.AUTO_LOAN,
  ManualAssetType.STUDENT_LOAN,
  ManualAssetType.PERSONAL_LOAN,
  ManualAssetType.OTHER_DEBT,
]);

export type FidelityTemplateId =
  | "fidelity-individual-tod"
  | "unitedhealth-contribution"
  | "unitedhealth-401k";

export type InvestmentTemplate = {
  id: FidelityTemplateId;
  label: string;
  name: string;
  institutionName: string;
  accountType: AccountType;
  accountSubtype: string;
  source: InvestmentSource;
};

export const FIDELITY_TEMPLATES: InvestmentTemplate[] = [
  {
    id: "fidelity-individual-tod",
    label: "Fidelity Individual TOD",
    name: "Fidelity Individual TOD",
    institutionName: "Fidelity Investments",
    accountType: AccountType.BROKERAGE,
    accountSubtype: "Taxable brokerage — individual TOD",
    source: "MANUAL",
  },
  {
    id: "unitedhealth-contribution",
    label: "UnitedHealth Contribution",
    name: "UnitedHealth Contribution",
    institutionName: "Fidelity NetBenefits",
    accountType: AccountType.RETIREMENT,
    accountSubtype: "Employer contribution retirement account",
    source: "MANUAL",
  },
  {
    id: "unitedhealth-401k",
    label: "UnitedHealth Group 401(k) Savings Plan",
    name: "UnitedHealth Group 401(k) Savings Plan",
    institutionName: "Fidelity NetBenefits",
    accountType: AccountType.FOUR_O_ONE_K,
    accountSubtype: "401(k) savings plan",
    source: "MANUAL",
  },
];

export function fidelityTemplate(value: string | undefined) {
  return FIDELITY_TEMPLATES.find((template) => template.id === value) ?? null;
}
