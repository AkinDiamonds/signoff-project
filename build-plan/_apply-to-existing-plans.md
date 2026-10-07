# Small edits to apply to the existing plan files

The existing scaffold zip was not regenerated. Make these additions by hand (or have the agent do it as part of step 00).

## plan/STATUS.md
Replace phase with "Build plan, step 00". Note: spike S1-S7 reported passed by the builder; S8-S14 answers pending in step 00's assumptions table. Next actions: step 00, then 01. Add open decision: checkout approach for the shop.

## plan/00-index.md
Add a row: `build-plan/` , Step-by-step implementation plan with per-step edge cases, tests and review logs.

## docs/decisions.md (append, status Proposed until step 00 accepts them)
- ADR-012: Add a buyer-facing storefront and buyer portal (`shop/`) plus a product site and judge guide, so both sides of every scenario can be tested in a browser. Three hosts under one registrable domain (signoff, shop, api) so cookies stay same-site. Consequence: about 22 more hours; the cut list protects the core.
- ADR-013: A fixture-driven PayPal stub exists for tests and local development only. It is selectable only when the environment is local or test and the application refuses to start with it in production. Real-sandbox runs remain the `@live` rehearsal.
- ADR-014: Demo data is scoped by a demo session id so concurrent judges do not trample each other. This is not multi-tenancy: there is one merchant and one charter; reset hides a session's disputes and never deletes ledger rows.

## plan/04-frontend-spec.md
Add a section "Buyer-facing surfaces": shop and buyer portal routes from `build-plan/contracts.md`, the "use a demo order" shortcut, the judge guide with a Buyer view and Merchant view switcher, and a note that both apps share `packages/ui` with separate themes.

## docs/architecture.md
Add tables `ledger_events` and `demo_sessions` (step 03) and shop tables for products, orders and order lines (step 30). Add two import rules: the orders client is importable only by the shop package; the buyer-side dispute client only by the simulator and shop packages. The agent and policy packages may import neither.

## plan/07-verify-register.md (append)
- V-23: Shop checkout approach (PayPal buttons versus redirect), allowed return URLs per app, and what the buyer sees in sandbox.
- V-24: Which sandbox buyer accounts can raise buyer-side disputes (only the one with consent), and what the shop does for other buyers.
- V-25: Content security origins needed by AG Studio and the PayPal checkout script.

## docs/claims-ledger.md
Add rows for: "Both sides testable from a browser", "Judge guide path takes about five minutes", "Hosted demo requires no setup".
