/**
 * Boundary validation schemas using Zod for values crossing trust boundaries.
 * Covers values that cannot be expressed purely in OpenAPI schemas.
 */

import { z } from 'zod';
import type {
  ApprovalToken,
  CreateDisputeRequest,
  CreateOrderRequest,
  DisputeId,
  Money,
  OrderCode,
  ResolveRequest,
  RuleId,
  SessionId,
  SupportedDisputeReason,
} from './types';

// --- Money Schema ---
// Matches PayPal shape: object with decimal string (strictly two places) and currency_code USD
export const moneySchema = z
  .object({
    value: z
      .string()
      .regex(/^\d+\.\d{2}$/, 'Money value must be a non-negative decimal string with exactly two decimal places'),
    currency_code: z.literal('USD', {
      errorMap: () => ({ message: 'Only USD currency is supported' }),
    }),
  })
  .strict()
  .transform((data) => data as unknown as Money);

export function parseMoney(input: unknown): Money {
  return moneySchema.parse(input);
}

// --- ID Schemas ---
export const disputeIdSchema = z
  .string()
  .trim()
  .min(1, 'Dispute ID cannot be empty')
  .max(128, 'Dispute ID too long')
  .transform((data) => data as unknown as DisputeId);

export const approvalTokenSchema = z
  .string()
  .min(32, 'Approval token must be at least 32 characters')
  .regex(/^[A-Za-z0-9_-]+$/, 'Approval token must be URL-safe')
  .transform((data) => data as unknown as ApprovalToken);

export const orderCodeSchema = z
  .string()
  .length(10, 'Order code must be exactly 10 characters')
  .regex(/^[A-Za-z0-9]{10}$/, 'Order code must be alphanumeric')
  .transform((data) => data as unknown as OrderCode);

export const sessionIdSchema = z
  .string()
  .trim()
  .min(1, 'Session ID cannot be empty')
  .max(256, 'Session ID too long')
  .transform((data) => data as unknown as SessionId);

// --- Rule ID Schema ---
export const ruleIdSchema = z
  .string()
  .regex(/^(G\d+-\d{2}|A-01|EXEC-STALE|EXEC-FAILED)$/, 'Invalid Rule ID pattern')
  .transform((data) => data as unknown as RuleId);

// --- Resolve Request Schema ---
const approveSchema = z.object({
  action: z.literal('APPROVE'),
}).strict();

const denySchema = z.object({
  action: z.literal('DENY'),
  reason: z.string().trim().min(1).optional(),
}).strict();

const editSchema = z.object({
  action: z.literal('EDIT'),
  amount: moneySchema.optional(),
  message: z.string().trim().min(1).optional(),
}).strict().superRefine((data, ctx) => {
  if (data.amount === undefined && data.message === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Edit action requires at least one of amount or message',
      path: ['amount'],
    });
  }
});

export const resolveRequestSchema = z.union([
  approveSchema,
  denySchema,
  editSchema,
]) as z.ZodType<ResolveRequest>;

// --- Create Order Request Schema ---
// Strict validation ensuring no client-provided price field is accepted!
export const createOrderRequestSchema = z
  .object({
    sku: z.string().trim().min(1, 'SKU is required').max(64, 'SKU too long'),
    quantity: z
      .number({ invalid_type_error: 'Quantity must be a number' })
      .int('Quantity must be an integer')
      .min(1, 'Quantity must be at least 1')
      .max(100, 'Quantity cannot exceed 100'),
  })
  .strict() as z.ZodType<CreateOrderRequest>;

// --- Create Dispute Request Schema ---
export const supportedDisputeReasonSchema = z.literal(
  'MERCHANDISE_OR_SERVICE_NOT_RECEIVED'
) as z.ZodType<SupportedDisputeReason>;

export const createDisputeRequestSchema = z
  .object({
    order_code: orderCodeSchema,
    reason: supportedDisputeReasonSchema,
    amount: moneySchema,
    buyer_message: z.string().trim().max(2000).optional(),
  })
  .strict() as unknown as z.ZodType<CreateDisputeRequest>;
