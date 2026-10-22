import { describe, expectTypeOf, it } from 'vitest';
import type { MoneyAmount } from '@signoff/ui';
import type {
  BuyerDisputeDetail,
  CreateDisputePayload,
  SupportedDisputeReason,
} from '../src/portal/types';

describe('Buyer Portal Type Contracts (Step 32)', () => {
  it('SupportedDisputeReason contains only supported reasons', () => {
    expectTypeOf<SupportedDisputeReason>().toEqualTypeOf<
      'MERCHANDISE_OR_SERVICE_NOT_RECEIVED' | 'MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED'
    >();

    // Valid reasons
    const _valid1: SupportedDisputeReason = 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED';
    const _valid2: SupportedDisputeReason = 'MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED';
    void _valid1;
    void _valid2;

    // @ts-expect-error - UNAUTHORISED is not a supported dispute reason
    const _invalidReason1: SupportedDisputeReason = 'UNAUTHORISED';
    void _invalidReason1;

    // @ts-expect-error - OTHER is not a supported dispute reason
    const _invalidReason2: SupportedDisputeReason = 'OTHER';
    void _invalidReason2;
  });

  it('CreateDisputePayload reason type contains only supported reasons', () => {
    expectTypeOf<CreateDisputePayload['reason']>().toEqualTypeOf<SupportedDisputeReason>();

    const validPayload: CreateDisputePayload = {
      customer_email: 'alex.morgan@example.test',
      reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
      amount: { value: '42.00', currency_code: 'USD' },
      message: 'Package did not arrive',
    };
    expectTypeOf(validPayload.reason).toEqualTypeOf<SupportedDisputeReason>();

    // @ts-expect-error - Cannot construct payload with unsupported reason
    const _invalidPayload: CreateDisputePayload = { customer_email: 'alex.morgan@example.test', reason: 'UNAUTHORISED', amount: { value: '42.00', currency_code: 'USD' }, message: 'Fraudulent charge' };
    void _invalidPayload;
  });

  it('CreateDisputePayload amount is strictly the Money type', () => {
    expectTypeOf<CreateDisputePayload['amount']>().toEqualTypeOf<MoneyAmount>();
    expectTypeOf<CreateDisputePayload['amount']['value']>().toEqualTypeOf<string>();
    expectTypeOf<CreateDisputePayload['amount']['currency_code']>().toEqualTypeOf<string>();

    // @ts-expect-error - Amount cannot be a number
    const _invalidAmountNum: CreateDisputePayload = { customer_email: 'alex.morgan@example.test', reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED', amount: 42.0, message: 'Missing item' };
    void _invalidAmountNum;

    // @ts-expect-error - Amount cannot be a plain string
    const _invalidAmountStr: CreateDisputePayload = { customer_email: 'alex.morgan@example.test', reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED', amount: '42.00', message: 'Missing item' };
    void _invalidAmountStr;
  });

  it('BuyerDisputeDetail models amount as MoneyAmount', () => {
    expectTypeOf<BuyerDisputeDetail['amount']>().toEqualTypeOf<MoneyAmount>();
  });
});
