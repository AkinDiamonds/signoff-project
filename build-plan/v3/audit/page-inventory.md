# Deployed page inventory

Read-only audit of the current deployed build. All mutating requests were blocked; only the local first-visit theme dialog was dismissed. HTTP 200 means route availability, not functional correctness. Screenshots remain in ignored scratch/v3-audit pending privacy review.

| App | Path | Width | HTTP | Page overflow | Uncaught JS errors | Theme picker dismissed |
|---|---|---:|---:|---|---:|---|
| merchant | / | 1440 | 200 | YES | 0 | no |
| merchant | /guide | 1440 | 200 | no | 0 | no |
| merchant | /app | 1440 | 200 | no | 0 | yes |
| merchant | /app/disputes | 1440 | 200 | no | 0 | no |
| merchant | /app/policy | 1440 | 200 | no | 0 | no |
| merchant | /app/settings | 1440 | 200 | no | 0 | no |
| merchant | /app/demo | 1440 | 200 | no | 0 | no |
| merchant | /app/pool | 1440 | 200 | no | 0 | no |
| merchant | /approve/audit-invalid-token | 1440 | 200 | no | 0 | no |
| shop | / | 1440 | 200 | no | 0 | no |
| shop | /cart | 1440 | 200 | no | 0 | no |
| shop | /checkout | 1440 | 200 | no | 0 | no |
| shop | /orders | 1440 | 200 | no | 0 | no |
| merchant | / | 390 | 200 | YES | 0 | no |
| merchant | /guide | 390 | 200 | YES | 0 | no |
| merchant | /app | 390 | 200 | no | 0 | yes |
| merchant | /app/disputes | 390 | 200 | no | 0 | no |
| merchant | /app/policy | 390 | 200 | no | 0 | no |
| merchant | /app/settings | 390 | 200 | no | 0 | no |
| merchant | /app/demo | 390 | 200 | no | 0 | no |
| merchant | /app/pool | 390 | 200 | no | 0 | no |
| merchant | /approve/audit-invalid-token | 390 | 200 | YES | 0 | no |
| shop | / | 390 | 200 | YES | 0 | no |
| shop | /cart | 390 | 200 | YES | 0 | no |
| shop | /checkout | 390 | 200 | YES | 0 | no |
| shop | /orders | 390 | 200 | YES | 0 | no |
| merchant | / | 320 | 200 | YES | 0 | no |
| merchant | /guide | 320 | 200 | YES | 0 | no |
| merchant | /app | 320 | 200 | YES | 0 | yes |
| merchant | /app/disputes | 320 | 200 | YES | 0 | no |
| merchant | /app/policy | 320 | 200 | YES | 0 | no |
| merchant | /app/settings | 320 | 200 | YES | 0 | no |
| merchant | /app/demo | 320 | 200 | YES | 0 | no |
| merchant | /app/pool | 320 | 200 | YES | 0 | no |
| merchant | /approve/audit-invalid-token | 320 | 200 | YES | 0 | no |
| shop | / | 320 | 200 | YES | 0 | no |
| shop | /cart | 320 | 200 | YES | 0 | no |
| shop | /checkout | 320 | 200 | YES | 0 | no |
| shop | /orders | 320 | 200 | YES | 0 | no |

## Limits and findings

- No uncaught page exceptions were observed during the short observation window; console warnings and late/background errors are not covered.
- Invalid approval uses a deliberately invalid token: its API 404 is expected and does not test a valid approval.
- Merchant Settings hardcodes connected identity/sync-success claims in source; route loading does not verify these claims.
- Theme selection interrupts first access; preserve a screenshot/record before moving this to optional appearance settings.
- Page-level horizontal overflow is directly measured after dismissing the theme dialog. Fix underlying layouts and rerun at the same widths.
- Product detail, actual order confirmation/detail, buyer dispute/reply/offer and valid approval states were NOT OBSERVED in this read-only pass. They need explicitly scoped fictional rehearsal data.
- No checkout, capture, policy save, demo scenario/reset, approval or PayPal mutation was performed.
- Render service revisions, worker heartbeat, real LLM request success and webhook verification remain NOT VERIFIED.
