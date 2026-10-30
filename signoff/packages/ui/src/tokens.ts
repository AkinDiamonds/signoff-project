/**
 * Design tokens for Signoff design system.
 * Measured from Shopify admin reference screenshots (01-home, 02-orders-list).
 * Implements 4px spacing scale, accessible color contrasts, and verdict semantics.
 */

// Badge palette shared by the semantic tokens and verdict colours below.
const badgeColors = {
  success: { bg: '#AEE9D1', border: '#AEE9D1', text: '#0C5132' },
  attention: { bg: '#FFD79D', border: '#FFD79D', text: '#5E4200' },
  critical: { bg: '#FED3D1', border: '#FED3D1', text: '#8E1F0B' },
} as const;

export const colors = {
  // Brand accents — teal kept for brand mark, active nav indicator only
  brandPrimary: '#0F766E', // Calm teal
  brandHover: '#115E59',
  brandSurface: '#F0FDFA',

  // Neutrals — Shopify Polaris measured values
  appBackground: '#F1F1F1', // Area behind cards (screenshot 02-orders-list)
  surface: '#FFFFFF', // Card fill
  surfaceSubtle: '#F8FAFC',
  border: '#E1E1E1', // 1px card and row divider
  borderStrong: '#C9CCCF',
  ink: '#303030', // Text primary: body and headings
  inkMuted: '#616161', // Text secondary: helper text, column headers

  // Actions — Shopify near-black button, blue link
  actionPrimary: '#303030', // The main button (near-black)
  actionPrimaryText: '#FFFFFF',
  linkInteractive: '#005BD3', // Links inside tables
  // Semantic aliases used by feature pages
  primaryAction: '#303030',
  interactive: '#005BD3',

  // Badge semantic tokens — Shopify success/attention/critical palette
  badgeSuccessBg: badgeColors.success.bg,
  badgeSuccessText: badgeColors.success.text,
  badgeSuccessBorder: badgeColors.success.border,
  badgeAttentionBg: badgeColors.attention.bg,
  badgeAttentionText: badgeColors.attention.text,
  badgeAttentionBorder: badgeColors.attention.border,
  badgeCriticalBg: badgeColors.critical.bg,
  badgeCriticalText: badgeColors.critical.text,
  badgeCriticalBorder: badgeColors.critical.border,

  // Verdicts (always paired with icon and label) — same badge palette
  verdict: {
    ALLOW: {
      bg: badgeColors.success.bg,
      border: badgeColors.success.border,
      text: badgeColors.success.text,
      icon: '✓',
      label: 'Allowed',
    },
    NEEDS_APPROVAL: {
      bg: badgeColors.attention.bg,
      border: badgeColors.attention.border,
      text: badgeColors.attention.text,
      icon: '⏳',
      label: 'Needs Approval',
    },
    DENY: {
      bg: badgeColors.critical.bg,
      border: badgeColors.critical.border,
      text: badgeColors.critical.text,
      icon: '✕',
      label: 'Denied',
    },
  },
} as const;

export const spacing = {
  // 4px scale — Shopify Polaris
  '0.5': '4px',
  1: '8px',
  '1.5': '12px',
  2: '16px',
  '2.5': '20px',
  3: '24px',
  4: '32px',
  5: '40px',
  6: '48px',
} as const;

export const radius = {
  card: '8px',
  control: '8px',
  pill: '999px',
} as const;

export const shadow = {
  card: '0 1px 0 rgba(0, 0, 0, 0.05)',
  popover: '0 4px 16px rgba(0, 0, 0, 0.12)',
} as const;

export const typography = {
  fontFamily:
    "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  fontSizeSmall: '12px',
  fontSizeBody: '13px',
  fontSizeHeading: '18px',
  fontSizeTitle: '20px',
  fontSizePageTitle: '20px',
  fontWeightNormal: 400,
  fontWeightMedium: 500,
  fontWeightSemibold: 600,
  lineHeightBody: '20px',
  rowHeight: '44px',
} as const;
