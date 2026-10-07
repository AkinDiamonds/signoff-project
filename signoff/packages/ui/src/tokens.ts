/**
 * Design tokens for Signoff design system.
 * Implements 8-pt spacing, accessible color contrasts, and verdict semantics.
 */

export const colors = {
  // Brand accents
  brandPrimary: '#0F766E', // Calm teal
  brandHover: '#115E59',
  brandSurface: '#F0FDFA',

  // Neutrals
  surface: '#FFFFFF',
  surfaceSubtle: '#F8FAFC',
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',
  ink: '#0F172A',
  inkMuted: '#64748B',

  // Verdicts (always paired with icon and label)
  verdict: {
    ALLOW: {
      bg: '#DCFCE7',
      border: '#86EFAC',
      text: '#166534',
      icon: '✓',
      label: 'Allowed',
    },
    NEEDS_APPROVAL: {
      bg: '#FEF3C7',
      border: '#FCD34D',
      text: '#92400E',
      icon: '⏳',
      label: 'Needs Approval',
    },
    DENY: {
      bg: '#FEE2E2',
      border: '#FCA5A5',
      text: '#991B1B',
      icon: '✕',
      label: 'Denied',
    },
  },
} as const;

export const spacing = {
  1: '8px',
  2: '16px',
  3: '24px',
  4: '32px',
  5: '40px',
  6: '48px',
} as const;

export const typography = {
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  fontSizeSmall: '12px',
  fontSizeBody: '14px',
  fontSizeHeading: '18px',
  fontSizeTitle: '24px',
} as const;
