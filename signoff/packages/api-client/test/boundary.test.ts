import { describe, expect, it } from 'vitest';
import {
  approvalTokenSchema,
  createDisputeRequestSchema,
  createOrderRequestSchema,
  disputeIdSchema,
  moneySchema,
  orderCodeSchema,
  parseMoney,
  resolveRequestSchema,
  ruleIdSchema,
} from '../src/schemas';

describe('Boundary Input Table Validation (types-testing.md)', () => {
  describe('Money Parser (moneySchema)', () => {
    it('accepts valid decimal strings with exactly two decimal places and USD', () => {
      const valid = moneySchema.parse({ value: '10.00', currency_code: 'USD' });
      expect(valid.value).toBe('10.00');
      expect(valid.currency_code).toBe('USD');

      const zero = parseMoney({ value: '0.00', currency_code: 'USD' });
      expect(zero.value).toBe('0.00');

      const huge = parseMoney({ value: '99999999.99', currency_code: 'USD' });
      expect(huge.value).toBe('99999999.99');
    });

    it('rejects numbers and plain strings', () => {
      expect(() => parseMoney(10.0)).toThrow();
      expect(() => parseMoney('10.00')).toThrow();
    });

    it('rejects empty, whitespace-only and null values', () => {
      expect(() => parseMoney({ value: '', currency_code: 'USD' })).toThrow();
      expect(() => parseMoney({ value: '   ', currency_code: 'USD' })).toThrow();
      expect(() => parseMoney({ value: null, currency_code: 'USD' })).toThrow();
      expect(() => parseMoney(null)).toThrow();
    });

    it('rejects wrong decimals: one decimal or more than two decimals', () => {
      expect(() => parseMoney({ value: '10.5', currency_code: 'USD' })).toThrow();
      expect(() => parseMoney({ value: '10.555', currency_code: 'USD' })).toThrow();
      expect(() => parseMoney({ value: '10', currency_code: 'USD' })).toThrow();
    });

    it('rejects negative amounts', () => {
      expect(() => parseMoney({ value: '-10.00', currency_code: 'USD' })).toThrow();
    });

    it('rejects non-USD currencies', () => {
      expect(() => parseMoney({ value: '10.00', currency_code: 'EUR' })).toThrow();
      expect(() => parseMoney({ value: '10.00', currency_code: 'GBP' })).toThrow();
    });

    it('rejects extra fields due to strict schema', () => {
      expect(() =>
        parseMoney({ value: '10.00', currency_code: 'USD', extra: 'forbidden' })
      ).toThrow();
    });
  });

  describe('ID Schemas', () => {
    it('validates DisputeId boundaries', () => {
      expect(disputeIdSchema.parse('PP-D-12345')).toBe('PP-D-12345');
      // Empty or whitespace only
      expect(() => disputeIdSchema.parse('')).toThrow();
      expect(() => disputeIdSchema.parse('   ')).toThrow();
      // Unicode & RTL
      expect(disputeIdSchema.parse('dispute-نزاع-123')).toBe('dispute-نزاع-123');
    });

    it('validates ApprovalToken boundaries (min 32 chars, URL-safe)', () => {
      const validToken = 'a'.repeat(32);
      expect(approvalTokenSchema.parse(validToken)).toBe(validToken);

      // Under minimum length (31 chars)
      expect(() => approvalTokenSchema.parse('a'.repeat(31))).toThrow();
      // Contains forbidden non-URL-safe characters
      expect(() => approvalTokenSchema.parse('a'.repeat(31) + ' ')).toThrow();
      expect(() => approvalTokenSchema.parse('a'.repeat(31) + '$')).toThrow();
    });

    it('validates OrderCode boundaries (exactly 10 alphanumeric chars)', () => {
      expect(orderCodeSchema.parse('ORD1234567')).toBe('ORD1234567');

      // Less than 10 or greater than 10
      expect(() => orderCodeSchema.parse('ORD123456')).toThrow();
      expect(() => orderCodeSchema.parse('ORD12345678')).toThrow();
      // Special characters or whitespace
      expect(() => orderCodeSchema.parse('ORD 123456')).toThrow();
      expect(() => orderCodeSchema.parse('ORD-123456')).toThrow();
    });
  });

  describe('Rule ID Schema', () => {
    it('accepts G<n>-<nn> and special allowed IDs', () => {
      expect(ruleIdSchema.parse('G1-01')).toBe('G1-01');
      expect(ruleIdSchema.parse('G12-15')).toBe('G12-15');
      expect(ruleIdSchema.parse('A-01')).toBe('A-01');
      expect(ruleIdSchema.parse('EXEC-STALE')).toBe('EXEC-STALE');
      expect(ruleIdSchema.parse('EXEC-FAILED')).toBe('EXEC-FAILED');
    });

    it('rejects invalid rule ID formats', () => {
      expect(() => ruleIdSchema.parse('R1-01')).toThrow();
      expect(() => ruleIdSchema.parse('G1-1')).toThrow();
      expect(() => ruleIdSchema.parse('G-01')).toThrow();
      expect(() => ruleIdSchema.parse('RANDOM_ID')).toThrow();
    });
  });

  describe('CreateOrderRequest Schema', () => {
    it('accepts valid orders and bounds quantity between 1 and 100', () => {
      expect(createOrderRequestSchema.parse({ sku: 'CANDLE-01', quantity: 1 })).toEqual({
        sku: 'CANDLE-01',
        quantity: 1,
      });
      expect(createOrderRequestSchema.parse({ sku: 'CANDLE-01', quantity: 100 })).toEqual({
        sku: 'CANDLE-01',
        quantity: 100,
      });

      // Quantity zero or negative
      expect(() => createOrderRequestSchema.parse({ sku: 'CANDLE-01', quantity: 0 })).toThrow();
      expect(() => createOrderRequestSchema.parse({ sku: 'CANDLE-01', quantity: -5 })).toThrow();
      // Quantity exceeds 100
      expect(() => createOrderRequestSchema.parse({ sku: 'CANDLE-01', quantity: 101 })).toThrow();
      // Non-integer
      expect(() => createOrderRequestSchema.parse({ sku: 'CANDLE-01', quantity: 2.5 })).toThrow();
    });

    it('strictly rejects any client-supplied price field', () => {
      expect(() =>
        createOrderRequestSchema.parse({
          sku: 'CANDLE-01',
          quantity: 2,
          price: '19.99',
        })
      ).toThrow();
    });
  });

  describe('ResolveRequest Schema', () => {
    it('validates APPROVE, DENY, and EDIT actions', () => {
      expect(resolveRequestSchema.parse({ action: 'APPROVE' })).toEqual({ action: 'APPROVE' });
      expect(resolveRequestSchema.parse({ action: 'DENY', reason: 'Invalid dispute' })).toEqual({
        action: 'DENY',
        reason: 'Invalid dispute',
      });

      // EDIT with amount
      expect(
        resolveRequestSchema.parse({
          action: 'EDIT',
          amount: { value: '15.00', currency_code: 'USD' },
        })
      ).toHaveProperty('action', 'EDIT');

      // EDIT with message
      expect(
        resolveRequestSchema.parse({
          action: 'EDIT',
          message: 'Counter offer message',
        })
      ).toHaveProperty('action', 'EDIT');

      // EDIT with both
      expect(
        resolveRequestSchema.parse({
          action: 'EDIT',
          amount: { value: '15.00', currency_code: 'USD' },
          message: 'Counter offer message',
        })
      ).toHaveProperty('action', 'EDIT');
    });

    it('rejects EDIT action without both amount and message', () => {
      expect(() => resolveRequestSchema.parse({ action: 'EDIT' })).toThrow();
    });
  });

  describe('CreateDisputeRequest Schema', () => {
    it('accepts supported dispute reasons and valid Money', () => {
      const parsed = createDisputeRequestSchema.parse({
        order_code: 'ORD1234567',
        reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
        amount: { value: '45.00', currency_code: 'USD' },
      });
      expect(parsed.reason).toBe('MERCHANDISE_OR_SERVICE_NOT_RECEIVED');
      expect(parsed.amount.value).toBe('45.00');
    });

    it('rejects unsupported reasons at the boundary', () => {
      expect(() =>
        createDisputeRequestSchema.parse({
          order_code: 'ORD1234567',
          reason: 'UNAUTHORIZED_TRANSACTION',
          amount: { value: '45.00', currency_code: 'USD' },
        })
      ).toThrow();
    });
  });
});
