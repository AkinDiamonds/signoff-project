/**
 * Storefront retail theme using @signoff/ui design tokens.
 *
 * Treatment:
 * - Page background: #FFFFFF
 * - Cards: No border, separation from spacing and a single subtle shadow
 * - Radius: 8px control and card radius
 * - Typography: Inter (with serif initials for artisan product cards)
 */

import { colors, radius, shadow, spacing, typography } from '@signoff/ui';

export { colors, radius, shadow, spacing, typography };

export const retailTheme = {
  pageBg: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceWarm: '#F8FAFC',
  imageBg: '#F7F4ED', // Warm parchment square placeholder
  cardShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
  radius: radius.card, // 8px
  fontFamily: typography.fontFamily,
  serifFont: 'Georgia, Cambria, "Times New Roman", Times, serif',
  ink: colors.ink, // #303030
  inkMuted: colors.inkMuted, // #616161
  primaryDark: colors.actionPrimary, // #303030 dark button
  primaryDarkText: colors.actionPrimaryText, // #FFFFFF
  borderSubtle: colors.border,
};

// Retain warmColors backward compatibility for existing references
export const warmColors = {
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceMuted: '#F7F4ED',
  border: colors.border,
  borderMuted: '#F1F1F1',
  borderFocus: colors.brandPrimary,
  ink: colors.ink,
  inkMuted: colors.inkMuted,
  inkSubtle: '#8C9196',

  // Actions
  primary: colors.actionPrimary,
  primaryHover: '#1A1A1A',
  primaryLight: '#F0FDFA',
  primaryBorder: colors.border,
  accent: colors.ink,

  // Status indicators using @signoff/ui palette
  successBg: colors.badgeSuccessBg,
  successInk: colors.badgeSuccessText,
  successBorder: colors.badgeSuccessBorder,
  errorBg: colors.badgeCriticalBg,
  errorInk: colors.badgeCriticalText,
  errorBorder: colors.badgeCriticalBorder,
  warningBg: colors.badgeAttentionBg,
  warningInk: colors.badgeAttentionText,
  warningBorder: colors.badgeAttentionBorder,
};

export const warmShadows = {
  sm: '0 1px 3px rgba(0, 0, 0, 0.04)',
  md: '0 2px 8px rgba(0, 0, 0, 0.04)',
  lg: '0 4px 16px rgba(0, 0, 0, 0.08)',
};
