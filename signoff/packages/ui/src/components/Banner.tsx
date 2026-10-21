import React from 'react';
import { colors, spacing } from '../tokens';

export type BannerVariant = 'sandbox' | 'frozen' | 'cached';

const BANNER_TEXT: Record<BannerVariant, string> = {
  sandbox: 'Sandbox demo, fictional data.',
  frozen: 'Demo is frozen. New scenarios and resets are disabled.',
  cached: 'Cached reasoning: this plan was replayed from the scenario cache, not generated live.',
};

export interface BannerProps {
  variant: BannerVariant;
  testId?: string;
}

export const Banner: React.FC<BannerProps> = ({ variant, testId }) => (
  <div
    role="status"
    data-testid={testId ?? `banner-${variant}`}
    style={{
      padding: `${spacing[1]} ${spacing[2]}`,
      backgroundColor: variant === 'frozen' ? colors.verdict.NEEDS_APPROVAL.bg : colors.brandSurface,
      borderBottom: `1px solid ${colors.border}`,
      color: colors.ink,
      fontSize: '14px',
    }}
  >
    {BANNER_TEXT[variant]}
  </div>
);
