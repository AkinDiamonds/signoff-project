import React from 'react';
import { colors } from '../tokens';

export type Verdict = keyof typeof colors.verdict;

const chipStyle = (bg: string, border: string, text: string): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '4px 10px',
  borderRadius: '9999px',
  fontSize: '12px',
  fontWeight: 600,
  backgroundColor: bg,
  border: `1px solid ${border}`,
  color: text,
});

export interface VerdictChipProps {
  verdict: Verdict;
  testId?: string | undefined;
}

export const VerdictChip: React.FC<VerdictChipProps> = ({ verdict, testId }) => {
  const meta = colors.verdict[verdict];
  return (
    <span data-testid={testId} style={chipStyle(meta.bg, meta.border, meta.text)}>
      <span aria-hidden="true">{meta.icon}</span>
      <span>{meta.label}</span>
    </span>
  );
};

export interface ServerVerdictChipProps {
  value: string | null;
  testId?: string | undefined;
}

const isVerdict = (value: string): value is Verdict =>
  Object.prototype.hasOwnProperty.call(colors.verdict, value);

export const ServerVerdictChip: React.FC<ServerVerdictChipProps> = ({ value, testId }) => {
  if (value !== null && isVerdict(value)) {
    return <VerdictChip verdict={value} testId={testId} />;
  }
  return (
    <span
      data-testid={testId}
      style={chipStyle(colors.surfaceSubtle, colors.borderStrong, colors.inkMuted)}
    >
      <span aria-hidden="true">?</span>
      <span>Unknown</span>
    </span>
  );
};
