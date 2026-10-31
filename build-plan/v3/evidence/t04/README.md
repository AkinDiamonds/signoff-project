# Local simulated shipping verification — 2026-10-31

Native HTTPS, production owner-cookie mode, current API/UI, isolated local `signoff_test_preview`. All order/payment IDs are fictional fixtures. No external provider or carrier calls. Desktop Chromium 156 at 390px/1440px; no physical Android claim.

Owner sign-in, persisted manual PRE_TRANSIT → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED, reload, terminal lock, withheld tracking, resume, exception, and 390px no-horizontal-overflow assertions passed. Safe [report](t04-browser-result.json), [phone viewport](t04-shipments-mobile.png), [desktop](t04-shipments-desktop.png).

Full checks: 600 backend tests (Ruff, strict mypy, three import contracts); 185 frontend tests (ESLint and type checking); enum/client freshness; both production builds. Persistent automatic schedule/restart and two-session PostgreSQL races are covered in backend tests. No full fresh PayPal/LLM execution, physical phone or new deployed shipping result is implied by this local evidence.

## Render observation

Main source `1930967` auto-deployed through the existing setup. New merchant/shop shipping bundles and API OpenAPI observed. Real owner login, retained/reloaded session, Secure/HttpOnly/SameSite=None/Partitioned cookie, missing-CSRF rejection, authenticated shipping GET200, page and 390px no-overflow, logout and denied access PASS. Fresh worker presence is verified; PayPal/LLM remain configured rather than newly proven. The list contains zero new paid shipments, so deployed automatic/manual milestones await a fresh hosted sandbox payment.

[Safe deployed report](deployed-report.json) and [phone viewport](deployed-shipments-mobile.png). Desktop Chromium, not physical Android. The first verification script reached Shipments successfully but attempted a Settings-only logout control there; returning to Settings corrected the probe. No application workaround or authentication weakening.

Branch CI [41236978982](https://github.com/AkinDiamonds/signoff-project/actions/runs/41236978982), main CI [41237185691](https://github.com/AkinDiamonds/signoff-project/actions/runs/41237185691) and main full E2E [41237185727](https://github.com/AkinDiamonds/signoff-project/actions/runs/41237185727) completed successfully; all 12 browser cases passed.
