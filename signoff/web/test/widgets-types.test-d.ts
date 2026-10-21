import { describe, expectTypeOf, it } from 'vitest';
import {
  STUDIO_WIDGET_DESCRIPTIONS,
  classifyDeadline,
  toAuthorityMeters,
  toDeadlineItems,
  toTimelineWidgetItems,
  type AuthorityMeterDatum,
  type DeadlineItem,
  type DeadlineUrgency,
  type TimelineWidgetItem,
  type WidgetDescriptor,
} from '../src/features/widgets/types';

describe('widget type contracts', () => {
  it('deadline urgency is a closed union and items come from api-client types', () => {
    expectTypeOf<DeadlineUrgency>().toEqualTypeOf<
      'OVERDUE' | 'DUE_SOON' | 'SCHEDULED' | 'NONE'
    >();
    // @ts-expect-error - SOON is not a deadline urgency
    const _invalid: DeadlineUrgency = 'SOON';

    expectTypeOf(classifyDeadline).parameter(0).toEqualTypeOf<string | null>();
    expectTypeOf(classifyDeadline).returns.toEqualTypeOf<DeadlineUrgency>();
    expectTypeOf(toDeadlineItems).returns.toEqualTypeOf<DeadlineItem[]>();
  });

  it('authority meter IDs are the three charter limits', () => {
    expectTypeOf<AuthorityMeterDatum['id']>().toEqualTypeOf<
      'auto_offer_max' | 'auto_accept_max' | 'auto_act_max_dispute_amount'
    >();
    expectTypeOf(toAuthorityMeters).returns.toEqualTypeOf<AuthorityMeterDatum[]>();
  });

  it('timeline widget items and Studio descriptors stay typed', () => {
    expectTypeOf(toTimelineWidgetItems).returns.toEqualTypeOf<TimelineWidgetItem[]>();
    expectTypeOf(STUDIO_WIDGET_DESCRIPTIONS).toMatchTypeOf<readonly WidgetDescriptor[]>();
    expectTypeOf<(typeof STUDIO_WIDGET_DESCRIPTIONS)[number]['id']>().toEqualTypeOf<
      'signoff-decision-timeline' | 'signoff-deadline-radar' | 'signoff-authority-meter'
    >();
  });
});
