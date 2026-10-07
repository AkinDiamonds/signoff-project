# Gate and charter spec

## Contract
```
ProposedAction  = discriminated union: ProvideEvidence | SendMessage | MakeOffer(amount) | AcceptClaim(amount?) | Escalate | Appeal
GateInput       = { action, dispute (fresh from PayPal), charter (versioned), history flags, now, prior_executions }
GateDecision    = { verdict: ALLOW|NEEDS_APPROVAL|DENY, rule_id, reason, action_hash, dispute_fingerprint, charter_version }
```
- The gate is a **pure function**: no I/O, no clock, no randomness. Same input → same output (replayable from the ledger).
- `GateDecision` is frozen and constructed only inside `policy/gate.py`. The executor refuses anything else.
- All checks are evaluated. If any check says DENY, the verdict is DENY (the lowest-numbered step's rule_id is recorded). Otherwise, if any says NEEDS_APPROVAL, the verdict is NEEDS_APPROVAL (lowest step's rule_id). Otherwise ALLOW. Every triggered rule is listed in the decision's `also_triggered` field for the log.
- **DENY** = impossible or forbidden (PayPal doesn't allow it, deadline passed, injection flag, duplicate). **NEEDS_APPROVAL** = permitted but beyond the merchant's standing authority.

## Checks (in order) and rule IDs
| Step | Rule | Verdict | Condition |
|---|---|---|---|
| 1 PayPal options | G1-01 | DENY | Action not in `allowed_response_options` or HATEOAS links |
| | G1-02 | DENY | Offer type / claim type not in PayPal's allowed list |
| 2 State and time | G2-01 | DENY | Status not `WAITING_FOR_SELLER_RESPONSE` (or other state that permits the action) |
| | G2-02 | DENY | `seller_response_due_date` passed |
| 3 Amount | G3-01 | NEEDS_APPROVAL | Offer amount > `auto_offer_max` |
| | G3-02 | NEEDS_APPROVAL | Accept amount > `auto_accept_max` |
| | G3-03 | DENY | Currency mismatch or non-positive amount |
| | G3-04 | DENY | Offer exceeds disputed amount |
| 4 Reason | G4-01 | NEEDS_APPROVAL | Reason in `never_auto_reasons` |
| | G4-02 | NEEDS_APPROVAL | Action in `never_auto_actions` (approval may allow it; auto never does) |
| 5 History | G5-01 | NEEDS_APPROVAL | Buyer disputes in window ≥ `repeat_disputer_threshold` |
| | G5-02 | DENY | Content-injection flag raised by the input screener (plan ignored) |
| 6 Idempotency | G6-01 | DENY | An execution already exists for (dispute, state fingerprint, action type) |
| 7 Defaults | G7-01 | ALLOW | All checks passed; action is auto-permitted by the charter flag (`auto_provide_evidence`, `auto_send_message`, within offer/accept limits) |
| | G0-00 | NEEDS_APPROVAL | Anything unexpected (fail closed) |

Deadline urgency is **not** a gate rule. It is an alert on the dashboard (Deadline Radar) and a push to approve; the gate never relaxes limits because time is short.

## Approval semantics
- Approval can waive **steps 3-5 only** (charter limits). It **never** waives steps 1, 2 or 6.
- An approval is bound to `action_hash`. An **edit** creates a new proposal that goes back through the gate; an approved edit is recorded with verdict `ALLOW` and `rule_id` `A-01` (approved by merchant).
- If the dispute's fingerprint changed between approval and execution, the executor aborts and the case is re-planned.

## Open question (ADR-007)
The handoff has both `auto_offer_max` and `approval_required_above` at 25.00, and Scenario C is "$180 dispute above the limit". Decide before coding G3:
- **Recommended:** limits apply to **money the merchant gives up** (`offer`, `accept`); add `auto_act_max_dispute_amount` for how large a dispute the agent may handle autonomously at all (evidence/message); drop `approval_required_above` or define it as the single ceiling that overrides both.

## Test matrix (all required)
- One allow, one deny/needs-approval and one **boundary** test per rule (`25.00` allowed, `25.01` needs approval).
- Property tests (hypothesis): (P1) never ALLOW if action ∉ allowed options; (P2) tightening any charter limit never turns a non-ALLOW into ALLOW; (P3) every decision has non-empty `rule_id` and `reason`; (P4) second identical call → G6-01; (P5) same input → identical output.
- Golden replays: ledger entries re-evaluated by the gate produce the stored verdicts.
- Injection suite asserts: no mutating call, `G5-02` or schema rejection logged.
