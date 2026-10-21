import { describe, expectTypeOf, it } from 'vitest';
import { kpisFixture, disputesFixture } from '../../fixtures/ui';
import {
  amountToCents,
  buildAssistantRequest,
  toStudioData,
  toStudioDisputeRows,
  toStudioKpiRows,
  type AssistantRequest,
  type StudioData,
  type StudioDisputeRow,
} from '../src/features/dashboard/types';

describe('dashboard adapter type contracts', () => {
  it('maps API types into typed Studio sources', () => {
    const data = toStudioData(kpisFixture, disputesFixture.items);
    expectTypeOf(data).toEqualTypeOf<StudioData>();
    expectTypeOf(data.sources[0].id).toEqualTypeOf<'disputes'>();
    expectTypeOf(data.sources[1].id).toEqualTypeOf<'kpis'>();
    expectTypeOf(data.sources[0].data).toEqualTypeOf<StudioDisputeRow[]>();

    const rows = toStudioDisputeRows(disputesFixture.items);
    expectTypeOf(rows).toEqualTypeOf<StudioDisputeRow[]>();
    expectTypeOf(rows[0]?.amount_cents).toEqualTypeOf<number | undefined>();
    expectTypeOf(toStudioKpiRows(kpisFixture)).toEqualTypeOf<
      Array<{ metric: string; value: string; numeric_value: number | null; note: string }>
    >();
  });

  it('money conversion stays integer and request shape is AssistantRequest', () => {
    expectTypeOf(amountToCents).parameter(0).toEqualTypeOf<string>();
    expectTypeOf(amountToCents('149.50')).toEqualTypeOf<number>();

    const request = buildAssistantRequest('How many?', kpisFixture, disputesFixture.items);
    expectTypeOf(request).toEqualTypeOf<AssistantRequest>();
  });
});
