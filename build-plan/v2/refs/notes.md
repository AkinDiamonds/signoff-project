# Measured Reference Values (Shopify Admin Polaris)

Reconciled from reference screenshots in `build-plan/v2/refs/`:
Historical third-party reference screenshots were removed from the current tree because redistribution permission was not established.

## Measured Token Table

| Token | Measured Value | Notes |
|---|---|---|
| App background | `#F1F1F1` | Canvas behind cards |
| Surface | `#FFFFFF` | Card & content background |
| Border | `#E1E1E1` | 1px card divider & row rule |
| Border Strong | `#C9CCCF` | Inputs & strong outlines |
| Text primary | `#303030` | Headings & body text |
| Text secondary | `#616161` | Column headers, hints, subtitles |
| Primary action | `#303030` on `#FFFFFF` | Near-black primary button |
| Link / interactive | `#005BD3` | Blue interactive links |
| Success badge | bg `#AEE9D1`, text `#0C5132` | "Allowed", "Paid", "Fulfilled" |
| Attention badge | bg `#FFD79D`, text `#5E4200` | "Needs Approval", "Pending", "Unfulfilled" |
| Critical badge | bg `#FED3D1`, text `#8E1F0B` | "Denied", "Refunded", "Cancelled" |
| Card radius | `8px` | Rounded corners on surface cards |
| Control radius | `8px` | Buttons, text inputs, form elements |
| Pill radius | `999px` | Badges |
| Body font | `Inter, 13px, 20px line-height` | Table body, standard text |
| Heading font | `Inter, 20px semibold` | Page titles |
| Row height | `44px` | Table rows |
| Spacing scale | `4px / 8px / 12px / 16px / 20px / 24px / 32px` | 4px scale |

## Accent Decision
- Brand accent: `#0F766E` (Signoff teal) reserved for brand mark & active nav indicator bar.
- Action controls: Near-black `#303030` buttons and blue `#005BD3` links match Shopify Polaris.
- Theme system: Presets (Light, Dark, Orange, Green, Blue, Lime, Custom) swap background, topbar, and sidebar via CSS variables.

