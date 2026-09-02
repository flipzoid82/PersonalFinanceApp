import { EconomicDirection, FinancialRole } from "@prisma/client";
import { z } from "zod";

const idSchema = z.string().trim().min(1).max(128);
const optionalCategory = z
  .string()
  .trim()
  .max(120, "Category must be 120 characters or fewer.")
  .transform((value) => value || null);
const optionalNotes = z
  .string()
  .trim()
  .max(1000, "Notes must be 1,000 characters or fewer.")
  .transform((value) => value || null);

export const transactionOverrideSchema = z.object({
  transactionId: idSchema,
  transactionCategoryId: z
    .union([idSchema, z.literal(""), z.null()])
    .transform((value) => value || null),
  categoryOverride: optionalCategory,
  financialRoleOverride: z
    .union([z.nativeEnum(FinancialRole), z.literal("")])
    .transform((value) => value || null),
  economicDirectionOverride: z
    .union([z.nativeEnum(EconomicDirection), z.literal(""), z.null()])
    .transform((value) => value || null),
  notes: optionalNotes,
  excludedFromReports: z.boolean(),
  intent: z.enum(["save", "clear"]),
});

export function transactionValidationMessage(error: z.ZodError) {
  return (
    error.issues[0]?.message ?? "The submitted transaction values are invalid."
  );
}

export type TransactionOverrideInput = z.infer<
  typeof transactionOverrideSchema
>;
