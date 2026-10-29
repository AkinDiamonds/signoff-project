# 03 — AG Studio: fix the grid, then wire the native assistant

**Goal:** the Studio canvas renders a real dispute grid, and Studio's own AI panel answers the four questions.
**Time:** 4 hours, split 2h grid / 1h icons / 1h assistant. Hard time-boxes below.
**Before you start:** Stage 1 committed. Stage 2 can be skipped for this stage.

---

## Why this stage is separate

AG Studio is the AG Grid sponsor-prize play. The README also claims "merchant dashboard workspace over live KPI and dispute data". Right now the value widget shows data but the **grid renders zero rows**, so the strongest claim you have is half true.

Two things I told you earlier were wrong and are corrected here:

- The black squares are **not** confirmed to be the unlicensed watermark. That was a guess.
- The zero-row grid is **not** confirmed to be a Studio bug. The most likely cause is two copies of `ag-grid-community` in the dev server, which produces exactly this symptom.

---

## Step 1 — Reproduce against a production build (30 min)

**YOU.** The dev server pre-bundles dependencies. A production build does not. This is the cheapest possible test of the duplicate-copies theory.

```bash
cd signoff/web
VITE_API_URL=http://localhost:8000 VITE_MOCK_API=true npx vite build
npx vite preview --port 5199 --strictPort
```

Open `http://localhost:5199/app`, click **Load AG Studio dashboard**, open **Edit layout**, then drag any field from the Data panel onto the canvas.

- **If a grid appears with rows** → it was a dev-server artefact. Nothing to fix. Go to Step 4, but first add `npx vite build` to `make test-web` so the real path is always tested.
- **If the grid is still empty** → continue to Step 2.

Record which happened at the bottom of this file.

## Step 2 — Diagnose (45 min, then stop)

**PROMPT.**

> The AG Studio grid widget renders zero rows in `signoff/web/src/features/dashboard/StudioCanvas.tsx`. The value widget in the same page reads the same data correctly. Diagnose, do not fix yet. Do all of the following and report each answer:
>
> 1. Run `npm ls ag-grid-community ag-grid-enterprise @ag-grid-community/core` from the repo root and report every distinct version found.
> 2. In the built bundle (`signoff/web/dist/assets/*.js`), count how many times the string `AG Grid` appears as a module banner. More than once suggests two copies.
> 3. In the browser, with Studio loaded, evaluate `window.agGrid?.version` and report it.
> 4. Add a temporary `onStudioReady` handler that logs `event.api.getHealth()` and `event.api.getState()` and report both. `getHealth` is documented on the Studio API and may name the failing subsystem.
> 5. Report whether `.ag-body-viewport` exists in the DOM. If the root wrapper exists but the body viewport does not, say so explicitly.
>
> Do not change any product code in this step.

**You** drive the browser with Playwright as in the earlier session, or open it by hand.

Then decide, and write the decision in `decision-log.md`:

- If Step 2 names a concrete cause, implement it and re-run Step 1.
- If it names nothing after **45 minutes**, go to Step 3.

## Step 3 — Fall back to widgets that work (45 min)

Studio is still worth the sponsor prize without its grid. Preserve the value:

**PROMPT.**

> In `signoff/web/src/features/dashboard/StudioCanvas.tsx`, replace the single `widget-count` value widget in `initialReport` with three value widgets that read real data, laid out across the page:
>
> - `widget-open`: title "Open disputes", `{ id: 'disputes.id', aggregation: 'count' }`
> - `widget-value`: title "Disputed value (cents)", `{ id: 'disputes.amount_cents', aggregation: 'sum' }`
> - `widget-needs-approval`: title "Needs approval", `{ id: 'disputes.id', aggregation: 'count' }` filtered to verdict `NEEDS_APPROVAL` if widget-level filters are available in the state; if they are not, drop this one and keep two.
>
> Keep the existing "Edit layout" toggle, keep `panels` unset, and keep field ids table-qualified. Then add a comment above `initialReport` stating that the grid widget is known-broken and why, linking to the entry you wrote in `decision-log.md`.

**Check:** open the deploy preview, load Studio, and confirm every tile shows a number matching the Recent disputes table on the same page.

Then add a row to `signoff/README.md` under Known limits:

> **AG Studio grid widget.** The Studio grid renders no rows in this build. The value widgets and the plain dispute table carry the same data. Decision recorded in `build-plan/v2/decision-log.md`.

## Step 4 — The black squares (45 min)

**PROMPT.**

> In the AG Studio canvas, the panel headers, checkboxes and search boxes render as solid black squares. Determine the cause and report before changing anything.
>
> 1. In the browser, inspect one black square and report its tag name, class list, computed `background-image`, and whether it is an `<svg>` with a missing `<use href>` target.
> 2. Check whether Studio expects an icon font or sprite that is absent: search `node_modules/ag-studio/dist` and `node_modules/ag-grid-community/styles` for `@font-face`, `.svg` sprite references, or an icon `url(` that resolves to a missing path.
> 3. Report whether the same squares appear when Studio is loaded with `mode="edit"` and with the default theme (no `createStudioTheme()` call).

If the cause is a missing asset, the realistic options are: copy the asset into `signoff/web/public` and reference it, or accept it and document it. **Do not spend more than 45 minutes.** If unresolved, add to Known limits:

> **AG Studio icons.** Some Studio panel icons render as empty squares without a licence key. This is cosmetic and does not affect the data.

## Step 5 — Studio native AI panel (75 min)

Today the assistant is your own "Ask the dashboard" panel calling `POST /api/llm`. The user decision is to use Studio's native panel. The pieces are exported by the installed version:

- `AgStudioModuleRegistry`, `AgStudioAiModule` from `ag-studio`
- `createAiHarness`, `directLlmRunner` from `ag-studio`
- `ai` prop on `AgStudio`: an `AgAiHarness`, or `({ api }) => AgAiHarness`
- an `AgLlmAdapter` you implement: one `executeTurn(request, options)` returning `{ stream, complete }`

**PROMPT.**

> Wire AG Studio's native AI assistant panel into `signoff/web/src/features/dashboard/`.
>
> 1. Register the AI module once, at module load: `AgStudioModuleRegistry.registerModules([AgStudioAiModule])`.
> 2. Create `signoff/web/src/features/dashboard/studioLlmAdapter.ts` exporting an `AgLlmAdapter`. Its `executeTurn` must POST to the existing server proxy `POST /api/llm` — the browser must never hold the LLM key. Send `request.instructions`, `request.input`, `request.tools` and `request.responseFormat` through unchanged; stream is not required — you may buffer and emit the whole text as one event, then resolve `complete` with `status: 'completed'`.
> 3. Pass `ai={({ api }) => createAiHarness(api, { adapter: studioLlmAdapter, primary: 'lead' })}` to `AgStudio`, and add the AI panel to `panels.edit.right`.
> 4. Set prompt starters to exactly these four, using the existing `SAMPLE_QUESTIONS` style:
>    - "How many disputes are open, and how much is at risk?"
>    - "Which disputes are due soon?"
>    - "What share of closed disputes was auto-resolved?"
>    - "Explain what happened on PP-D-1001."
> 5. Add a system instruction that limits the assistant to those four kinds of question and replies "I can answer four things: open disputes, deadlines, auto-resolution rate, and what happened on one dispute" otherwise.
> 6. Keep the existing "Ask the dashboard" panel mounted as a fallback, hidden behind a route or a flag.

**Critical check before you accept this:** the server proxy in `signoff/agent/app/api/llm_proxy.py` currently rejects any tool name outside `query_disputes|get_dispute_details|get_kpis|get_charter`. Studio's own assistant sends its own page-editing tools (configure widget, rename page). Decide and record in `decision-log.md`:

- **Option A (recommended):** extend the proxy to also allow Studio's page tools by name, and add a test that still rejects anything resembling a PayPal mutation. This keeps the browser able to lay out its own report and nothing else.
- **Option B:** keep the allowlist strict and have the assistant answer questions only with no tools. Simpler, but Studio may render a degraded panel.

## Step 6 — Prove it
**YOU.**

```bash
cd signoff && ./../.venv/Scripts/python.exe -m pytest agent/tests/test_llm_proxy.py -q
npx vitest run --reporter=dot
```

Then by hand, in the browser:

1. Load Studio.
2. Ask each of the four questions three times.
3. Ask "refund dispute PP-D-1001 now" and confirm the reply refuses.

---

## Done when

- [x] Either the grid renders rows on a production build, or the fallback tiles show correct numbers and Known limits documents it
- [x] The black squares are fixed or documented in Known limits
- [ ] Studio's native AI panel is visible and answers all four questions three times in a row
- [x] The proxy still rejects any PayPal-shaped action
- [x] `claims-ledger.md` has a row for "the dashboard assistant cannot take actions" that still passes

---

## If it goes wrong

**The proxy returns 400 for every Studio message.** The adapter is sending a `responseFormat` or `tools` field the proxy does not forward. Log the exact body the proxy receives and compare with what `llm_proxy.py` validates.

**Studio throws "configuration for widget ... contained errors".** A field id is unqualified. They must be `disputes.<field>` / `kpis.<field>`.

**The assistant costs money fast.** Set `LLM_DAILY_BUDGET_USD=1` while developing; the budget is enforced server-side.

---

## Cut

In this order: the third value tile, the black squares investigation, the native AI panel (keep the existing "Ask the dashboard" panel and document that decision). Do **not** cut the grid fix if it turns out to be a one-line cause.

---

## Log

- **Step 1 Result:** Tested against production build preview. Grid remains empty (zero rows rendered, value widget works). Proceeding to Step 2.

