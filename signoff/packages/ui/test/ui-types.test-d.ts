import { describe, expectTypeOf, it } from 'vitest';
import type { MoneyAmount, MoneyProps } from '../src/components/Money';
import type { VerdictChipProps } from '../src/components/VerdictChip';

describe('ui type contracts', () => {
  it('Money props accept only the string-valued amount shape', () => {
    expectTypeOf<MoneyProps['money']>().toEqualTypeOf<MoneyAmount>();
    expectTypeOf<MoneyAmount['value']>().toEqualTypeOf<string>();
    // @ts-expect-error - a bare number is not a valid Money value
    const bad: MoneyProps = { money: { value: 42, currency_code: 'USD' } };
    void bad;
  });

  it('VerdictChip accepts only the Verdict union', () => {
    expectTypeOf<VerdictChipProps['verdict']>().toEqualTypeOf<'ALLOW' | 'NEEDS_APPROVAL' | 'DENY'>();
    // @ts-expect-error - a string outside the union is rejected
    const bad: VerdictChipProps = { verdict: 'MAYBE' };
    void bad;
  });
});
