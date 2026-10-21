import React from 'react';
import { AgStudio } from 'ag-studio-react';
import { createStudioTheme } from 'ag-studio';
import { colors, typography } from '@signoff/ui';
import type { StudioData } from './types';

const studioTheme = createStudioTheme().withParams({
  fontFamily: typography.fontFamily,
  backgroundColor: colors.surface,
  textColor: colors.ink,
  borderColor: colors.border,
  studioCanvasBackgroundColor: colors.surfaceSubtle,
  studioWidgetBackgroundColor: colors.surface,
  studioWidgetBorderRadius: 8,
  studioToggleButtonActiveBackgroundColor: colors.brandPrimary,
  studioToggleButtonActiveBorderColor: colors.brandPrimary,
  chartPaletteFills1Color: colors.brandPrimary,
  chartPaletteFills2Color: colors.verdict.ALLOW.border,
  chartPaletteFills3Color: colors.verdict.NEEDS_APPROVAL.border,
  chartPaletteFills4Color: colors.verdict.DENY.border,
});

export const StudioCanvas: React.FC<{ data: StudioData }> = ({ data }) => (
  <AgStudio data={data} mode="edit" theme={studioTheme} style={{ height: '600px', width: '100%' }} />
);
