# T12 UI and copy direction — working draft

This plan is for a first-time small seller checking disputes on a phone. The seller should be able to answer, in order: **What needs me now? Why? What will happen if I act? Did anything actually get sent?** The first design pass covers the merchant dispute journey and uses calm, plain language. The owner selected the **white and cobalt** visual direction and wants **PayPal status, Signoff review state, and action delivery state always visible near the top** of dispute detail.

## Screen order

1. **Dashboard:** lead with cases needing a decision and the nearest actual PayPal deadline. Show a short list of next actions before metrics or the assistant. Put analytics and Studio below the operational list; preserve their function.
2. **Dispute list:** one card per case at phone widths. Show buyer reason, amount, deadline, PayPal status, and a separate Signoff action state. Use the dispute ID as secondary detail. Filters should fit a 320px viewport and survive back navigation.
3. **Dispute detail:** begin with a one-sentence situation summary, the actual deadline, and one primary next action. Always show three distinct status lines near the top: PayPal dispute status, Signoff review state, and whether an action was sent. Then show buyer statement, evidence with source and gaps, proposed action with rule explanation, approval and execution status, and chronological history. Keep technical IDs in expandable details, but retain audit access.
4. **Approval:** lead with a short plain-language summary of the buyer's claim, proposed response, amount (when relevant), reason for review, and what the final tap will authorize. Put the full evidence and audit details below. Distinguish saved approval, queued action, sent action, and observed PayPal state. A resolved historical approval without execution must say so plainly and offer a configured support email.
5. **Notifications:** write each item as an event plus an actionable next step. Opening a case should preserve the ability to return to the same notification/list position.
6. **Signing limits and Settings:** explain each limit with an example and state whether it controls automatic actions or actions that need review. Keep phone notification permission, local display test and delivery status distinct.
7. **Buyer shop and order journey:** retain the candle shop's own visual identity. Make checkout, order lookup, dispute information and evidence status readable on 320px and 390px screens. Do not imply that Signoff itself opens a PayPal dispute for the buyer.

## Copy rules

- Use “buyer”, “seller”, “dispute”, “review”, and “PayPal” consistently. Avoid “agent”, “gate”, “fingerprint”, “verdict”, and raw rule codes in the primary view.
- Lead with the seller's next step and the actual deadline. Explain what a button does before the seller commits.
- State observed facts at their source: “Approval saved”, “Action queued”, “Sent to PayPal”, “PayPal dispute now shows …”. A Signoff `CONFIRMED` record alone is not independent action-specific proof.
- For uncertainty, say what is known and what the seller can do next. Never use a fixed response window where PayPal supplies a dispute deadline.
- Keep error messages recoverable and specific; show whether retrying might duplicate an action before offering a retry.
- Treat fictional/demo activity, simulated shipping, and live sandbox data as visibly different.

## Draft primary copy

| Place | Draft |
| --- | --- |
| Dashboard heading | Your disputes |
| Dashboard lead | Cases that need your attention, ordered by deadline. |
| Empty attention state | Nothing needs your review right now. We’ll show new disputes and decisions here. |
| Dispute detail heading | Buyer says their item has not arrived *(example reason)* |
| Dispute summary | PayPal is waiting for your response. Review the order and evidence before the deadline. |
| Approval pending | Your review is needed before this action can be sent. |
| Approval saved, no execution | You approved this action. It has not been sent to PayPal. |
| Action queued | Your approval was saved. The action is waiting to be sent. |
| Evidence strength | Evidence available: [level]. See what is included and what is missing. |
| Signing limits | Set the amounts Signoff may handle automatically. Larger or uncertain actions need your review. |

## Dispute state copy contract

The three visible status lines must be derived from separate source fields. A missing field displays “Status unavailable” with a last checked time; it must never inherit another line's state. The primary action must be supported by a current route and authorization, not inferred from an old approval record.

| Situation | PayPal line | Signoff line | Action line | Main copy |
| --- | --- | --- | --- | --- |
| Review needed, current card available | Waiting for your response | Your review is needed | Nothing sent | Review the proposed response before anything is sent to PayPal. |
| Approval saved, queued | Show current PayPal status | Approval saved | Waiting to be sent | Your approval is saved. Check here for the sending result. |
| Approval saved, no execution record | Show current PayPal status | Approval saved | Not sent | Your approval was saved, but this action was not sent to PayPal. Show a contact/support route, not a resend action. |
| Execution intended or sent, result unknown | Show current PayPal status | Review complete | Result unknown | Signoff cannot yet tell whether PayPal received this action. Sending it again could duplicate the response. Show a prominent warning and no retry button. |
| Recorded confirmation | Show current PayPal status | Review complete | Recorded as confirmed | Signoff recorded a confirmation after checking PayPal. The specific action has not been independently verified. |
| Failed run before submission | Show current PayPal status | Analysis could not finish | Nothing sent | Signoff could not prepare a response. Review the case and try the analysis again when available. |
| PayPal dispute resolved | Resolved | Show latest Signoff state | Show actual delivery state | This dispute is resolved in PayPal. Review the history to see what happened. |

These are design strings, not a claim that the current API supplies every necessary state. Before implementation, map each line to actual response fields and identify gaps. The owner selected a configured support email for approved-but-unsent actions, but confirmed no support address is set up yet. Do not render a contact button until the address is configured and verified. For now, show: “Your approval was saved, but the action was not sent to PayPal. Check this dispute in PayPal before taking another step.” Keep the local history available. Never invent a support address or silently make an old approval actionable.

## Review and delivery sequence

1. Agree on audience, tone, priority journey and a representative fictional dispute.
2. Produce two reviewable phone mockups (dashboard and dispute detail/approval) at 390px, plus a 320px stress view. Include realistic copy and all pending/error/empty states, not only a polished happy path.
3. Test the mockup with three questions: can a seller find the next action, explain its effect, and tell whether PayPal received it?
4. Apply the approved hierarchy and copy to shared components and audited screens. Classify each existing control as retained, fixed, honestly disabled, or removed with reason.
5. Verify 320px/390px overflow, keyboard and focus order, serious accessibility findings, refresh and back, plus the hosted cross-view checks still open under T11. Use focused checks during implementation.

## Open decisions

- The extent to which the white and cobalt direction should carry into the buyer shop, which has a different purchase context.
- A seller support email address and its configuration across environments; this is a dependency for the contact button, not a blocker for the rest of the design.

## First visual concepts

The first phone concept shows a dispute in **approval requested** state. Its order, date, amount and evidence are illustrative design content, not verified PayPal records. The hierarchy is: PayPal status and deadline → seller review action → buyer statement → available/missing evidence → proposed response and reason for review → chronological record → technical details. The concept must be reviewed against the actual action and evidence contracts before implementation. In particular, a dispute detail cannot link to an approval decision unless a valid, authorized approval route exists for that seller.

A second concept explores a white and cobalt visual direction. The owner selected it. It separates **PayPal status**, **Signoff review state**, and **action delivery** in a visible three-row summary. Its restrained urgency color appears only on the actual deadline. Both images are design sketches; no case data or action route in them is a verified product state.
