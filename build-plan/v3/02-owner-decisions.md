# Agreed product decisions

These answers were supplied directly by the owner after reviewing the master plan. They override conflicting recommendations in the original plan.

1. **Product audience:** build a normal merchant product, not a developer/judge-only interface. Evaluation instructions describe the real product; demo-only controls belong in an explicitly labeled sandbox mode.
2. **Merchant scope:** this release uses the owner's single merchant PayPal sandbox account. No multi-merchant onboarding or general PayPal OAuth marketplace is required.
3. **Shipping:** persist automatic simulated shipping progression AND provide manual sandbox controls to advance it immediately. Preserve source labels and timestamps. Do not claim real carrier tracking.
4. **Missing delivery evidence:** default to human review. The merchant must be able to change the behavior in Settings/Policy. Any permitted automatic settlement remains subject to the existing deterministic policy, signing limits and PayPal constraints.
5. **Login:** minimal email/password authentication for the owner is accepted where required to protect merchant controls. No public registration, password-recovery workflow or email service. Account provisioning/reset are administrative, outside the public app. Do not ask for a password in chat or embed it in source.
6. **Autonomy:** the agent may execute valid actions automatically when evidence and merchant policy permit. Actions requiring approval must wait for explicit approval; approval never overrides hard PayPal, stale-state or idempotency constraints.
7. **Existing retained scope:** mobile usability, toasts, persistent notifications and opt-in mobile push; trustworthy evidence, real sandbox PayPal/LLM integration, deployed Render verification.
8. **Primary phone:** the owner will test on Android. Prioritize Android Chrome push and phone approval validation; do not claim iPhone physical-device validation from that evidence.
9. **Buyer dispute journey (reconfirmed):** the separately deployed shop hands payment approval to PayPal-hosted checkout. Buyers later report problems and manage disputes separately in PayPal's Resolution Center, never through a Signoff buyer-dispute form. Signoff's merchant product receives verified PayPal webhooks and continues evidence → policy gate → approval/execution. Legacy buyer assertion/forms are local stub rehearsal fixtures only and must not be available on the deployed product.
10. **Release mechanism:** the owner has configured Render to auto-deploy `main` and authorizes pushing the tested compatible release to `main`. Use that existing setup; no Render workspace/configuration recreation is requested. The owner will install the generated owner-login variables securely in Render.

## Supplied competition rules affecting release

Source: owner-uploaded official-rules text, read during this conversation. This records the supplied document, not independent verification of a current website.

- PayPal sandbox integration plus an AI tool/model is required; PayPal must be central. Sponsor AI tools are optional.
- Functionality must match the description/video; judges assess a complete coherent product experience.
- A working accessible build is required; hosted deployment is one permitted route and remains this owner's goal.
- Public source repository and detectable open-source license are required.
- Private access requires testing login/access instructions. Keep evaluation access available through the end of judging.
- Target a public YouTube demonstration under three minutes showing the actual device experience; submission materials are in English or translated.
- Submission closes November 12, 2026 at 12:00 Pacific / 20:00 UTC / 21:00 Africa/Lagos.
- Judging ends December 15, 2026 at 08:00 Pacific / 16:00 UTC / 17:00 Africa/Lagos.
- Nothing in the supplied rules requires multiple merchants, a general signup flow, password recovery or an email provider.

Do not publish server credentials or production secrets in a public README. Supply restricted sandbox testing access through appropriate testing instructions; protect owner access and private keys.
