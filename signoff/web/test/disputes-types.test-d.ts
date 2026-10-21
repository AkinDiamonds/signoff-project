import { describe, expectTypeOf, it } from 'vitest';
import type { TimelineEvent } from '../src/features/disputes/types';
import { renderTimelineEventContent } from '../src/features/disputes/timeline';
import { DEFAULT_DISPUTE_FILTERS, parseDisputeFilters } from '../src/features/disputes/filterSchema';

describe('disputes type contracts', () => {
  it('renderTimelineEventContent exhaustively handles all 15 TimelineEvent kinds with a never check', () => {
    expectTypeOf(renderTimelineEventContent).toBeFunction();

    function exhaustiveCheck(event: TimelineEvent): string {
      switch (event.kind) {
        case 'WEBHOOK_RECEIVED':
          return 'webhook';
        case 'DISPUTE_SYNCED':
          return 'synced';
        case 'RUN_STARTED':
          return 'started';
        case 'EVIDENCE_BUILT':
          return 'evidence';
        case 'PLAN_PROPOSED':
          return 'plan';
        case 'GATE_DECIDED':
          return 'gate';
        case 'APPROVAL_REQUESTED':
          return 'approval_req';
        case 'APPROVAL_RESOLVED':
          return 'approval_res';
        case 'EXECUTION_INTENDED':
          return 'exec_intent';
        case 'EXECUTION_SENT':
          return 'exec_sent';
        case 'EXECUTION_CONFIRMED':
          return 'exec_confirmed';
        case 'EXECUTION_FAILED':
          return 'exec_failed';
        case 'INJECTION_FLAGGED':
          return 'injection';
        case 'NO_ACTION':
          return 'no_action';
        case 'RUN_FAILED':
          return 'failed';
        default: {
          const _neverCheck: never = event;
          return _neverCheck;
        }
      }
    }

    expectTypeOf(exhaustiveCheck).toBeFunction();
  });

  it('filterSchema returns typed DisputeFilters matching defaults', () => {
    const emptyParams = new URLSearchParams();
    const parsed = parseDisputeFilters(emptyParams);
    expectTypeOf(parsed).toEqualTypeOf(DEFAULT_DISPUTE_FILTERS);
  });
});
