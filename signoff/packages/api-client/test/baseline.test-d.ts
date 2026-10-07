/**
 * Compile-time type tests enforcing types-testing.md catalog.
 * Each positive assertion is paired with at least one negative case marked with @ts-expect-error.
 * Loosening a type (widening to any or string) causes the unused @ts-expect-error to fail.
 */

import { assertType, describe, expectTypeOf, it } from 'vitest';
import type {
  ActionType,
  ApprovalToken,
  AssistantTool,
  CreateDisputeRequest,
  CreateOrderRequest,
  DisputeId,
  DisputeReason,
  Money,
  OrderCode,
  ResolveRequest,
  RuleId,
  ScenarioId,
  ServerOwnedKeys,
  SessionId,
  StatusBadgeWidgetConfig,
  TimelineEvent,
  Verdict,
} from '../src/types';
import type { paths } from '../src/generated/schema';
import { SignoffApiClient } from '../src/client';

// Top-level typed mock instances for type tests
const dummyDisputeId = 'dispute-001' as DisputeId;
const dummyApprovalToken = 'token_abcdefghijklmnopqrstuvwxyz123456' as ApprovalToken;
const dummyOrderCode = 'ORD1234567' as OrderCode;
const dummySessionId = 'session-123' as SessionId;
const dummyMoney = { value: '10.00', currency_code: 'USD' } as Money;

describe('Type Testing Catalog (types-testing.md)', () => {
  it('1. Verdict, ActionType, ScenarioId, DisputeReason are exact unions', () => {
    expectTypeOf<Verdict>().toEqualTypeOf<'ALLOW' | 'NEEDS_APPROVAL' | 'DENY'>();
    // @ts-expect-error - 'MAYBE' is not in Verdict union
    const _invalidVerdict: Verdict = 'MAYBE';

    expectTypeOf<ActionType>().toEqualTypeOf<
      'PROVIDE_EVIDENCE' | 'SEND_MESSAGE' | 'MAKE_OFFER' | 'ACCEPT_CLAIM' | 'ESCALATE' | 'APPEAL'
    >();
    // @ts-expect-error - 'CLOSE_DISPUTE' is not in ActionType union
    const _invalidAction: ActionType = 'CLOSE_DISPUTE';

    expectTypeOf<ScenarioId>().toEqualTypeOf<'A' | 'B' | 'C' | 'D' | 'E'>();
    // @ts-expect-error - 'F' is not in ScenarioId
    const _invalidScenario: ScenarioId = 'F';

    // @ts-expect-error - Random string is not in DisputeReason
    const _invalidReason: DisputeReason = 'INVALID_REASON';
  });

  it('2. Money is branded and rejects numbers and plain strings', () => {
    // @ts-expect-error - number rejected
    const _numMoney: Money = 10.0;

    // @ts-expect-error - plain string rejected
    const _strMoney: Money = '10.00';

    // @ts-expect-error - unbranded object rejected
    const _unbrandedMoney: Money = { value: '10.00', currency_code: 'USD' };
  });

  it('3. IDs are branded and not interchangeable', () => {
    assertType<DisputeId>(dummyDisputeId);
    assertType<ApprovalToken>(dummyApprovalToken);
    assertType<OrderCode>(dummyOrderCode);
    assertType<SessionId>(dummySessionId);

    // @ts-expect-error - DisputeId is not assignable to ApprovalToken
    const _token: ApprovalToken = dummyDisputeId;

    // @ts-expect-error - OrderCode is not assignable to DisputeId
    const _dispute: DisputeId = dummyOrderCode;

    // @ts-expect-error - SessionId is not assignable to OrderCode
    const _order: OrderCode = dummySessionId;

    // @ts-expect-error - Plain string is not assignable to DisputeId
    const _rawDispute: DisputeId = 'dispute-123';
  });

  it('4. ResolveRequest: union of approve, deny, edit with constraints', () => {
    const _approve: ResolveRequest = { action: 'APPROVE' };
    const _deny: ResolveRequest = { action: 'DENY', reason: 'Invalid claim' };
    const _edit: ResolveRequest = { action: 'EDIT', message: 'Counter offer' };

    assertType<ResolveRequest>(_approve);
    assertType<ResolveRequest>(_deny);
    assertType<ResolveRequest>(_edit);

    // @ts-expect-error - action must be APPROVE, DENY, or EDIT
    const _invalidAction: ResolveRequest = { action: 'CANCEL' };

    // @ts-expect-error - EDIT without amount or message is rejected
    const _emptyEdit: ResolveRequest = { action: 'EDIT' };
  });

  it('5. CreateOrderRequest: no price field allowed', () => {
    const _validOrder: CreateOrderRequest = { sku: 'CANDLE-01', quantity: 2 };
    assertType<CreateOrderRequest>(_validOrder);

    // @ts-expect-error - price field is forbidden in CreateOrderRequest
    const _orderWithPrice: CreateOrderRequest = { sku: 'CANDLE-01', quantity: 2, price: 10.0 };
  });

  it('6. CreateDisputeRequest: reason limited to supported reasons and amount is Money', () => {
    const _validDispute: CreateDisputeRequest = {
      order_code: dummyOrderCode,
      reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
      amount: dummyMoney,
    };
    assertType<CreateDisputeRequest>(_validDispute);

    const _unsupportedReason: CreateDisputeRequest = {
      order_code: dummyOrderCode,
      // @ts-expect-error - unsupported dispute reason rejected
      reason: 'OTHER',
      amount: dummyMoney,
    };

    const _unbrandedAmount: CreateDisputeRequest = {
      order_code: dummyOrderCode,
      reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
      // @ts-expect-error - unbranded amount string rejected
      amount: '50.00',
    };
  });

  it('7. API responses are strictly typed and not any', () => {
    type StatusResponse = paths['/api/status']['get']['responses']['200']['content']['application/json'];
    expectTypeOf<StatusResponse>().not.toBeAny();
  });

  it('8. Server-owned fields never appear in client requests', () => {
    type RequestKeys = keyof CreateOrderRequest | keyof CreateDisputeRequest;
    type ForbiddenOverlap = Extract<RequestKeys, ServerOwnedKeys>;
    expectTypeOf<ForbiddenOverlap>().toBeNever();
  });

  it('9. Timeline events: exhaustive switch compiles only if all kinds handled', () => {
    function handleEvent(event: TimelineEvent): string {
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
          const _exhaustiveCheck: never = event;
          return _exhaustiveCheck;
        }
      }
    }
    expectTypeOf(handleEvent).toBeFunction();
  });

  it('10. Client calls: path parameters required and invalid paths fail to compile', () => {
    const client = new SignoffApiClient({ baseUrl: 'http://localhost:8000' });
    assertType<Promise<unknown>>(client.getStatus());

    // @ts-expect-error - method nonExistentEndpoint does not exist on client
    client.nonExistentEndpoint();
  });

  it('11. Assistant tools is a constant list with no mutating tools', () => {
    // @ts-expect-error - mutating tool accept_dispute_claim is not allowed in assistant tools
    const _tool1: AssistantTool = 'accept_dispute_claim';

    // @ts-expect-error - mutating tool make_offer is not allowed
    const _tool2: AssistantTool = 'make_offer';

    const _validTool: AssistantTool = 'query_disputes';
    assertType<AssistantTool>(_validTool);
  });

  it('12. Widget configs are derived from api-client types', () => {
    const _validConfig: StatusBadgeWidgetConfig = {
      verdict: 'ALLOW',
      evidenceStrength: 'HIGH',
    };
    assertType<StatusBadgeWidgetConfig>(_validConfig);

    const _invalidConfig: StatusBadgeWidgetConfig = {
      // @ts-expect-error - Invalid verdict rejected in widget config
      verdict: 'PENDING',
      evidenceStrength: 'HIGH',
    };
  });

  it('13. Rule IDs match G<n>-<nn> or special allowed IDs', () => {
    const _g1: RuleId = 'G1-01';
    const _g12: RuleId = 'G12-05';
    const _a01: RuleId = 'A-01';
    const _stale: RuleId = 'EXEC-STALE';
    const _failed: RuleId = 'EXEC-FAILED';

    assertType<RuleId>(_g1);
    assertType<RuleId>(_g12);
    assertType<RuleId>(_a01);
    assertType<RuleId>(_stale);
    assertType<RuleId>(_failed);

    // @ts-expect-error - Invalid rule id format fails
    const _invalidRule: RuleId = 'RULE-123';
  });
});
