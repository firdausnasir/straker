import { z } from "zod";
import {
  COMMITMENT_TYPES,
  CURRENCIES,
  CYCLES,
  RENEWAL_MODES,
  REMINDER_MIN_LEAD_DAYS,
  REMINDER_MAX_LEAD_DAYS,
} from "./constants";

// All external input is parsed here so internal logic works on trusted state.

export const credentialsSchema = z.object({
  email: z.email("Enter a valid email").trim().toLowerCase(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type Credentials = z.infer<typeof credentialsSchema>;

export const commitmentInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  type: z.enum(COMMITMENT_TYPES),
  // Major-unit amount as entered by the user (e.g. "19.90"). Converted to
  // integer minor units before storage. Reject zero/negative at the boundary.
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  currency: z.enum(CURRENCIES),
  cycle: z.enum(CYCLES),
  // ISO date string (yyyy-mm-dd) from the date input.
  nextDueDate: z.coerce.date(),
  renewalMode: z.enum(RENEWAL_MODES),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  // Per-commitment due-date reminder opt-in + lead time (days before due).
  reminderEnabled: z.boolean().optional(),
  reminderLeadDays: z.coerce
    .number()
    .int()
    .min(REMINDER_MIN_LEAD_DAYS)
    .max(REMINDER_MAX_LEAD_DAYS)
    .optional(),
});

export type CommitmentInput = z.infer<typeof commitmentInputSchema>;

// Partial schema for edits — every field optional, but each still validated.
export const commitmentUpdateSchema = commitmentInputSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// Browser PushSubscription as serialized by `subscription.toJSON()`. Only the
// fields we persist are validated; extra keys are ignored.
export const pushSubscriptionSchema = z.object({
  endpoint: z.url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;
