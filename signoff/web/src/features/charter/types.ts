import type { components } from '@signoff/api-client/generated';
import type { ActionType, DisputeReason } from '@signoff/api-client';

export type Charter = components['schemas']['CharterResponse'];
export type CharterUpdate = components['schemas']['UpdateCharterRequest'];

export const DISPUTE_REASONS = [
  'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
  'MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED',
  'UNAUTHORISED',
  'CREDIT_NOT_PROCESSED',
  'DUPLICATE_TRANSACTION',
  'INCORRECT_AMOUNT',
  'PAYMENT_BY_OTHER_MEANS',
  'CANCELED_RECURRING_BILLING',
  'PROBLEM_WITH_REMITTANCE',
  'OTHER',
] as const satisfies readonly DisputeReason[];

export const ACTION_TYPES = [
  'PROVIDE_EVIDENCE',
  'SEND_MESSAGE',
  'MAKE_OFFER',
  'ACCEPT_CLAIM',
  'ESCALATE',
  'APPEAL',
] as const satisfies readonly ActionType[];

export interface CharterFormValues {
  autoOfferMax: string;
  autoAcceptMax: string;
  autoActMaxDisputeAmount: string;
  repeatDisputerThreshold: string;
  autoProvideEvidence: boolean;
  autoSendMessage: boolean;
  neverAutoReasons: DisputeReason[];
  neverAutoActions: ActionType[];
}

export type CharterMoneyField =
  | 'autoOfferMax'
  | 'autoAcceptMax'
  | 'autoActMaxDisputeAmount';

export interface CharterFieldErrors {
  autoOfferMax?: string;
  autoAcceptMax?: string;
  autoActMaxDisputeAmount?: string;
  repeatDisputerThreshold?: string;
}

export type CharterBuildResult =
  | { ok: true; value: CharterUpdate }
  | { ok: false; errors: CharterFieldErrors };

const MONEY_INPUT = /^(0|[1-9]\d*)(\.\d{1,2})?$/;
const INTEGER_INPUT = /^\d+$/;

export function normalizeMoneyInput(value: string): string | null {
  const trimmed = value.trim();
  if (!MONEY_INPUT.test(trimmed)) {
    return null;
  }
  const [whole = '0', fraction = ''] = trimmed.split('.');
  return `${whole}.${fraction.padEnd(2, '0')}`;
}

export function toFormValues(charter: Charter): CharterFormValues {
  return {
    autoOfferMax: charter.auto_offer_max.value,
    autoAcceptMax: charter.auto_accept_max.value,
    autoActMaxDisputeAmount: charter.auto_act_max_dispute_amount.value,
    repeatDisputerThreshold: String(charter.repeat_disputer_threshold),
    autoProvideEvidence: charter.auto_provide_evidence,
    autoSendMessage: charter.auto_send_message,
    neverAutoReasons: [...(charter.never_auto_reasons ?? [])],
    neverAutoActions: [...(charter.never_auto_actions ?? [])],
  };
}

export function buildCharterUpdate(
  values: CharterFormValues,
  baseVersion: number
): CharterBuildResult {
  const errors: CharterFieldErrors = {};
  const offer = normalizeMoneyInput(values.autoOfferMax);
  const accept = normalizeMoneyInput(values.autoAcceptMax);
  const act = normalizeMoneyInput(values.autoActMaxDisputeAmount);

  if (offer === null) {
    errors.autoOfferMax = 'Enter an amount like 25.00 (up to two decimals).';
  }
  if (accept === null) {
    errors.autoAcceptMax = 'Enter an amount like 25.00 (up to two decimals).';
  }
  if (act === null) {
    errors.autoActMaxDisputeAmount = 'Enter an amount like 100.00 (up to two decimals).';
  }
  const threshold = values.repeatDisputerThreshold.trim();
  if (!INTEGER_INPUT.test(threshold)) {
    errors.repeatDisputerThreshold = 'Enter a whole number (0 or more).';
  }

  if (offer === null || accept === null || act === null || !INTEGER_INPUT.test(threshold)) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      auto_offer_max: { currency_code: 'USD', value: offer },
      auto_accept_max: { currency_code: 'USD', value: accept },
      auto_act_max_dispute_amount: { currency_code: 'USD', value: act },
      repeat_disputer_threshold: Number(threshold),
      auto_provide_evidence: values.autoProvideEvidence,
      auto_send_message: values.autoSendMessage,
      never_auto_reasons: values.neverAutoReasons,
      never_auto_actions: values.neverAutoActions,
      base_version: baseVersion,
    },
  };
}

export function toggleList<T>(items: readonly T[], item: T): T[] {
  return items.includes(item) ? items.filter((value) => value !== item) : [...items, item];
}
