import { describe, expectTypeOf, it } from 'vitest';
import type { ScenarioId } from '@signoff/api-client';
import type { CharterFormValues } from '../src/features/charter/types';
import { buildCharterUpdate, normalizeMoneyInput } from '../src/features/charter/types';
import { SCENARIO_BUTTONS, type ScenarioButton } from '../src/features/demo/types';

describe('charter and demo type contracts', () => {
  it('scenario buttons are driven by the ScenarioId union', () => {
    expectTypeOf(SCENARIO_BUTTONS).toEqualTypeOf<readonly ScenarioButton[]>();
    expectTypeOf(SCENARIO_BUTTONS[0]?.id).toMatchTypeOf<ScenarioId | undefined>();

    // @ts-expect-error - F is not a scenario id
    const _invalid: ScenarioId = 'F';

    expectTypeOf<ScenarioId>().toEqualTypeOf<'A' | 'B' | 'C' | 'D' | 'E'>();
  });

  it('charter form values and build results stay typed', () => {
    const values: CharterFormValues = {
      autoOfferMax: '25.00',
      autoAcceptMax: '25.00',
      autoActMaxDisputeAmount: '100.00',
      repeatDisputerThreshold: '2',
      autoProvideEvidence: true,
      autoSendMessage: true,
      neverAutoReasons: [],
      neverAutoActions: ['APPEAL'],
    };

    const built = buildCharterUpdate(values, 1);
    if (built.ok) {
      expectTypeOf(built.value.base_version).toEqualTypeOf<number>();
      expectTypeOf(built.value.auto_offer_max.value).toEqualTypeOf<string | number>();
    } else {
      expectTypeOf(built.errors.autoOfferMax).toEqualTypeOf<string | undefined>();
    }

    expectTypeOf(normalizeMoneyInput).parameter(0).toEqualTypeOf<string>();
    expectTypeOf(normalizeMoneyInput).returns.toEqualTypeOf<string | null>();
  });
});
