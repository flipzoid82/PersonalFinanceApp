import { AccountType, ManualAssetType, Prisma } from "@prisma/client";
import { z } from "zod";

const idSchema = z.string().trim().min(1).max(128);
const optionalText = z
  .string()
  .trim()
  .max(1000)
  .transform((value) => value || null);
const dateSchema = z.string().refine((value) => {
  const date = new Date(value);
  return value.length > 0 && !Number.isNaN(date.getTime());
}, "Enter a valid date and time.");

export const moneySchema = z
  .string()
  .trim()
  .refine((value) => /^\d{1,15}(\.\d{1,4})?$/.test(value), {
    message: "Enter a non-negative amount with up to four decimal places.",
  })
  .transform((value) => new Prisma.Decimal(value));

export const currencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "Use a three-letter currency code.");

export const accountSchema = z.object({
  name: z.string().trim().min(1, "Account name is required.").max(120),
  institutionName: z
    .string()
    .trim()
    .max(120)
    .transform((value) => value || null),
  accountType: z.nativeEnum(AccountType),
  accountSubtype: z
    .string()
    .trim()
    .max(120)
    .transform((value) => value || null),
  currency: currencySchema,
  currentBalance: moneySchema,
  availableBalance: z
    .union([moneySchema, z.literal("")])
    .transform((value) => value || null),
  creditLimit: z
    .union([moneySchema, z.literal("")])
    .transform((value) => value || null),
  notes: optionalText,
});

export const updateAccountSchema = accountSchema.extend({
  accountId: idSchema,
});

export const accountIdSchema = z.object({ accountId: idSchema });

export const balanceSnapshotSchema = z.object({
  accountId: idSchema,
  currentBalance: moneySchema,
  availableBalance: z
    .union([moneySchema, z.literal("")])
    .transform((value) => value || null),
  capturedAt: dateSchema.transform((value) => new Date(value)),
});

export const balanceSnapshotIdSchema = z.object({ snapshotId: idSchema });

export const manualAssetSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  assetType: z.nativeEnum(ManualAssetType),
  currentValue: moneySchema,
  costBasis: z
    .union([moneySchema, z.literal("")])
    .transform((value) => value || null),
  currency: currencySchema,
  acquiredAt: z.union([
    z
      .string()
      .refine(
        (value) => !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime()),
        "Enter a valid acquisition date.",
      )
      .transform((value) => new Date(`${value}T00:00:00.000Z`)),
    z.literal("").transform(() => null),
  ]),
  notes: optionalText,
});

export const updateManualAssetSchema = manualAssetSchema.extend({
  assetId: idSchema,
});

export const manualAssetIdSchema = z.object({ assetId: idSchema });

export const investmentSnapshotSchema = z.object({
  accountId: idSchema,
  totalValue: moneySchema,
  vestedValue: z
    .union([moneySchema, z.literal("")])
    .transform((value) => value || null),
  asOfDate: dateSchema.transform((value) => new Date(value)),
  notes: optionalText,
});

export const updateInvestmentSnapshotSchema = investmentSnapshotSchema.extend({
  snapshotId: idSchema,
});

export const investmentSnapshotIdSchema = z.object({
  snapshotId: idSchema,
});

export function validationMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "The submitted values are invalid.";
}

export type AccountInput = z.infer<typeof accountSchema>;
export type BalanceSnapshotInput = z.infer<typeof balanceSnapshotSchema>;
export type ManualAssetInput = z.infer<typeof manualAssetSchema>;
export type InvestmentSnapshotInput = z.infer<typeof investmentSnapshotSchema>;
