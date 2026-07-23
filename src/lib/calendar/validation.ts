import { CalendarEventType, RecurringFrequency } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { parseIsoDate } from "./dates";

const idSchema = z.string().trim().min(1).max(128);
const dateSchema = z
  .string()
  .refine((value) => Boolean(parseIsoDate(value)), "Enter a valid date.");
const moneySchema = z
  .string()
  .trim()
  .refine((value) => /^\d{1,15}(\.\d{1,4})?$/.test(value), {
    message: "Enter a positive amount with no more than four decimal places.",
  })
  .transform((value) => new Prisma.Decimal(value))
  .refine((value) => value.greaterThan(0), "Amount must be greater than zero.");

export const eventActionSchema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal("confirm"),
    eventId: idSchema,
    date: dateSchema,
  }),
  z.object({
    intent: z.literal("correct-date"),
    eventId: idSchema,
    date: dateSchema,
  }),
  z.object({
    intent: z.literal("correct-amount"),
    eventId: idSchema,
    amount: moneySchema,
  }),
  z.object({
    intent: z.literal("correct-frequency"),
    eventId: idSchema,
    frequency: z.nativeEnum(RecurringFrequency),
  }),
  z.object({ intent: z.literal("mark-paid"), eventId: idSchema }),
  z.object({ intent: z.literal("mark-skipped"), eventId: idSchema }),
  z.object({ intent: z.literal("not-a-bill"), eventId: idSchema }),
  z.object({
    intent: z.literal("notes"),
    eventId: idSchema,
    notes: z.string().trim().max(1000),
  }),
]);

export const deactivateSchema = z.object({ streamId: idSchema });

export const acceptMatchSchema = z.object({
  eventId: idSchema,
  transactionId: idSchema,
  confirmLowConfidence: z.boolean(),
});

export const manualEventSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  eventType: z.nativeEnum(CalendarEventType),
  date: dateSchema,
  amount: moneySchema,
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Use a three-letter currency code."),
  accountId: z
    .union([idSchema, z.literal("")])
    .transform((value) => value || null),
  frequency: z.nativeEnum(RecurringFrequency),
  dateKind: z.enum(["confirmed", "predicted"]),
  notes: z.string().trim().max(1000),
});

export type EventActionInput = z.infer<typeof eventActionSchema>;
export type ManualEventInput = z.infer<typeof manualEventSchema>;

export function validationMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "The submitted values are invalid.";
}
