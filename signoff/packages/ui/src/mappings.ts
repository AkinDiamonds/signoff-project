/**
 * Plain-language mappings for disputes, reasons, and policy gate rules.
 * Reference: build-plan/v2/refs/copy-rules.md & signoff/agent/app/policy/rules.py
 */

const REASON_MAP: Record<string, string> = {
  MERCHANDISE_OR_SERVICE_NOT_RECEIVED: 'Item not received',
  MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED: 'Not as described',
  NOT_AS_DESCRIBED: 'Not as described',
  UNAUTHORISED: 'Unauthorised transaction',
  UNAUTHORIZED: 'Unauthorised transaction',
  INCORRECT_AMOUNT: 'Incorrect amount charged',
  DUPLICATE_TRANSACTION: 'Duplicate transaction',
  CANCELED_RECURRING_BILLING: 'Cancelled recurring billing',
  PROBLEM_WITH_SERVICE: 'Service issue',
};

/**
 * Format raw dispute reason into clean Shopify-style plain language.
 * Never outputs raw enum identifiers.
 */
export function formatDisputeReason(reason: string | null | undefined): string {
  if (!reason) {
    return 'Other';
  }
  const clean = reason.trim().toUpperCase();
  if (REASON_MAP[clean]) {
    return REASON_MAP[clean];
  }
  // If formatted as SNAKE_CASE, replace underscores with spaces and title case if unknown
  const fallback = clean.replace(/_/g, ' ').toLowerCase();
  return fallback.charAt(0).toUpperCase() + fallback.slice(1);
}

const RULE_EXPLANATIONS: Record<string, string> = {
  'G1-01': 'Checks that the requested action is permitted by PayPal on this dispute',
  'G1-02': 'Ensures offer or claim type matches PayPal allowed dispute types',
  'G2-01': 'Verifies dispute status allows seller response action',
  'G2-02': 'Ensures seller response due date has not passed',
  'G3-01': 'Requires human approval when refund exceeds standard authority threshold',
  'G3-02': 'Requires human approval when accept amount exceeds standard authority threshold',
  'G3-03': 'Guards against currency mismatch or non-positive refund amount',
  'G3-04': 'Guards against refund offer exceeding the total disputed amount',
  'G4-01': 'Requires human review for dispute reasons marked as sensitive in charter',
  'G4-02': 'Requires human review for actions restricted in merchant charter',
  'G5-01': 'Flags repeat disputers exceeding dispute threshold for human review',
  'G5-02': 'Guards against prompt-injection or suspicious buyer content',
  'G6-01': 'Guards against duplicate execution for this dispute state and action',
  'G7-01': 'Applies standing default policy when all prior gate criteria are satisfied',
};

/**
 * Retrieve plain-English explanation for policy gate rules without exposing internal jargon like "fingerprint".
 */
export function getRuleExplanation(ruleId: string | null | undefined): string {
  if (!ruleId) {
    return 'Policy gate check';
  }
  const normalized = ruleId.trim().toUpperCase();
  return RULE_EXPLANATIONS[normalized] ?? `Protective rule ${normalized}`;
}

