import { describe, expectTypeOf, it } from 'vitest';
import { parseMoney } from '@signoff/api-client';
import type { Money, ResolveRequest } from '@signoff/api-client';
import { buildEditResolveRequest, type EditRequestPayload } from '../src/features/approval/types';
import { parseAmountInput } from '../src/features/approval/amountParser';

describe('approval type contracts', () => {
  it('amount parser returns strongly typed Money when successful', () => {
    const res = parseAmountInput('25.00');
    if (res.ok) {
      expectTypeOf(res.money).toEqualTypeOf<Money>();
      expectTypeOf(res.money.value).toEqualTypeOf<string>();
      expectTypeOf(res.money.currency_code).toEqualTypeOf<'USD'>();
    }
  });

  it('buildEditResolveRequest constructs valid ResolveRequest', () => {
    const dummyMoney: Money = parseMoney({ value: '25.00', currency_code: 'USD' });

    const withAmount = buildEditResolveRequest({ amount: dummyMoney });
    expectTypeOf(withAmount).toEqualTypeOf<ResolveRequest>();

    const withMessage = buildEditResolveRequest({ message: 'Counter proposal' });
    expectTypeOf(withMessage).toEqualTypeOf<ResolveRequest>();

    const withBoth = buildEditResolveRequest({ amount: dummyMoney, message: 'Both' });
    expectTypeOf(withBoth).toEqualTypeOf<ResolveRequest>();
  });

  it('an edit with no fields cannot be constructed', () => {
    // @ts-expect-error - EditRequestPayload requires at least amount or message
    const _badPayload: EditRequestPayload = {};
    void _badPayload;

    // @ts-expect-error - Direct construction of ResolveRequest action EDIT requires amount or message
    const _badEdit: ResolveRequest = { action: 'EDIT' };
    void _badEdit;
  });
});
