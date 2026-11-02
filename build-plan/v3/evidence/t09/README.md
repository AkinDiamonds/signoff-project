# In-app notification inbox — local verification

The screenshot uses fictional local stub data at 390px in desktop Chromium; it is not a physical Android test. It shows the persistent in-app inbox and unread/read controls. New-dispute, review, approval and execution updates use generic text; the outbox is stored but phone-push delivery is not implemented by this increment.

Local checks: 630 backend tests in the final full run before the added dedicated PostgreSQL rollback test; focused notification tests passed including PostgreSQL atomic deduplication/rollback. 190 frontend tests passed, plus focused read/unread/reload and failure-state checks. Full cross-app suite passed 13 tests, including a fictional local webhook → inbox → read/reload case; a subsequent focused browser run verified the dispute link opens the correct case. Ruff, strict mypy, types/client freshness and production builds passed. No real PayPal write was performed.
