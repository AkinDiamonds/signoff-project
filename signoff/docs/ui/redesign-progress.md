# Signoff redesign progress

The specification and mockups were retrieved from `origin/main` (`970413d`) under `signoff/docs/ui`. The starting branch was `work` at `e7331ca`; `main` adds design documents but does not add merchant application features beyond that commit. The HTML plan is named `Signoff_Notion_Mobile_First_Plan.html`; six mockups are present.

## Routes

- [ ] Login
- [ ] Home
- [ ] Disputes and case detail, including approval
- [ ] Updates
- [ ] More
- [ ] Reports
- [ ] Shipments
- [ ] Signing limits / Rules and Charter alias — unchanged saves and mobile save-bar overlap addressed; full redesign pending specification
- [ ] Settings and Appearance
- [ ] Help
- [ ] Demo scenarios and Demo disputes — corrected empty-pool copy; full redesign pending

## Completed

- Created `codex/signoff-notion-mobile` from the clean `work` branch.
- Disabled saving unchanged or reverted signing limits and guarded the handler against unchanged submissions. Existing version history remains intact.
- Unified list deadline calculation with the shared detail formatter and removed “Respond by” before a missing deadline. Corrected demo-pool empty copy to use the actual finished count.
- Positioned the signing-limits save bar above the mobile navigation, accounting for the bottom safe area; kept it in document flow.
- Added component regression coverage for unchanged and reverted forms, and a browser geometry regression at 320, 375, 390 and 430 pixels.

## Validation and unresolved work

- Charter component tests: 6 passed.
- Browser geometry regression: passed using system Chromium and mock API at four mobile widths. The bundled Playwright browser is absent.
- Full route redesign, metric investigation, screenshots, approval-expiry and mixed-execution regressions, full responsive/keyboard review, and physical-device testing remain outstanding. The requested `signoff-audit.html` is not present on remote main; the HTML plan has a different name.
- `npm run lint`, `npx tsc --noEmit`, and `npx vitest run --maxWorkers=2 --minWorkers=1` passed (211 tests). Production builds passed with a local placeholder API URL; Vite warned about large bundles. After the deadline and pool fixes, targeted lint and 26 tests passed.
- `npm run test:web` fails because its configured Vitest projects are not defined in the current configuration; use the repository's `make test-web`/Vitest command for the suite instead.
