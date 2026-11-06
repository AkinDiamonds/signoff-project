# Signoff UI structure

These wireframes describe the mobile flow. The desktop workspace uses the same content hierarchy with a persistent sidebar and a wider disputes table. Data and actions are shown only when available from the application.

## Mobile wireframes

```text
HOME                         DISPUTES
[✓] Signoff    Signoff Shop  [✓] Signoff    Signoff Shop
Home                         All disputes
Needs your attention         Search / Status / Reason
[case, amount, reason]       [Case · amount]
[deadline] [Review dispute]  [Reason · deadline]
Upcoming deadlines           [Open case]
Summary                      First page / Next page
Home Disputes Updates More   Home Disputes Updates More

CASE DETAIL                  REVIEW REPLY
← Back to disputes           [Case and amount]
[reason, amount, deadline]   [Proposed response]
What happened                [Evidence and signing rule]
What we found                [Review or edit]
What’s missing               [Confirm / decline]
Your reply                   [Outcome: approval saved]
Updates                      (delivery and resolution shown separately)
Home Disputes Updates More

MORE                         APPEARANCE
Reports                      ← Settings
Shipments                    Display: Light / Dark / Device
Rules                        Accent: Forest / Blue / Violet / Slate
Settings                     [Preview]
Help                         [Apply appearance]
Buyer shop                   Home Disputes Updates More
```

The dispute list retains its filters in the URL. A case opened from the list carries the originating URL and scroll position back to the list. Approval and execution are distinct from PayPal resolution; uncertain sends retain their duplicate-action warning.

## Component sheet

- **Type:** Inter; 28px page titles, 20px section headings, 16px body and buttons, 14px supporting labels. Money uses tabular numerals and an explicit currency.
- **Buttons:** 48px minimum height; solid accent for the primary action, outlined neutral for secondary actions, and text links for navigation. Disabled buttons reduce opacity; keyboard focus receives a visible outline.
- **Fields:** visible labels, neutral borders and native input semantics; validation messages remain adjacent to their fields.
- **Rows:** separators rather than nested cards; numeric values align on desktop. At phone widths table cells stack with their column labels.
- **Status:** semantic labels accompany colors. Approval, action delivery, and PayPal state are separate.
- **Navigation:** labelled Home, Disputes, Updates and More; selected item has a contrasting indicator. Main content reserves space for the fixed mobile bar.
- **Feedback:** loading, empty and error messages identify the affected section and offer retry where available. A saved approval does not imply a sent action or a resolved dispute.

The installed icon is the authoritative identity: white check on `#14532d`. Its colors do not change with appearance settings. Semantic warning colors remain separate from the chosen accent.

## Dependency decision: desktop dispute grid

Use the MIT-licensed AG Grid Community and React packages, pinned at 36.2.0, for the desktop dispute workspace. These packages are already present in the lockfile as AG Studio dependencies; declaring them directly makes the workspace's dependency explicit. The mobile view retains the labelled list, and case actions remain links to the existing full detail route. The dispute grid now also uses AG Grid Enterprise features (ADR-016).
