export const concept = {
  surface: 'var(--signoff-surface, #FFFFFF)',
  subtle: 'var(--signoff-subtle, #F6F6F5)',
  border: 'var(--signoff-divider, #E7E6E2)',
  ink: 'var(--signoff-ink, #1B1B19)',
  muted: 'var(--signoff-muted, #6B6B66)',
  primary: 'var(--signoff-action-primary, #135E3D)',
  primaryDark: '#07472C',
  primarySoft: '#E5F2EA',
  track: '#F1F1EE',
  warningBg: '#FDF3D9',
  dangerText: '#A12A22',
  disabledBg: '#E5E5E1',
  disabledText: '#8A8A84',
} as const;

export type PillTone = 'amber' | 'green' | 'blue' | 'purple' | 'gray' | 'red';

// Pill text stays near-black on pastel backgrounds in both light and dark display modes.
export const pillColors: Record<PillTone, { bg: string; text: string }> = {
  amber: { bg: '#FEE8B5', text: '#1B1B19' },
  green: { bg: '#DCF6E6', text: '#1B1B19' },
  blue: { bg: '#E3F1FD', text: '#1B1B19' },
  purple: { bg: '#EDE9FE', text: '#1B1B19' },
  gray: { bg: '#F1F1EE', text: '#1B1B19' },
  red: { bg: '#FBE3E1', text: '#A12A22' },
};

export const conceptType = {
  pageTitle: { fontSize: 40, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.05 },
  caseTitle: { fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1 },
  section: { fontSize: 22, fontWeight: 750, letterSpacing: '-0.01em', lineHeight: 1.2 },
} as const;
