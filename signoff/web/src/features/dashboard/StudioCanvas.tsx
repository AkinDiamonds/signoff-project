import React, { useState } from 'react';
import { AgStudio } from 'ag-studio-react';
import { createStudioTheme } from 'ag-studio';
import type { AgReportState } from 'ag-studio';
import { Button, colors, typography } from '@signoff/ui';
import type { StudioData } from './types';

const studioTheme = createStudioTheme().withParams({
  fontFamily: typography.fontFamily,
  backgroundColor: colors.surface,
  textColor: colors.ink,
  borderColor: colors.border,
  accentColor: colors.brandPrimary,
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

// Studio opens on a saved report rather than an empty canvas, so the first thing a
// judge sees is a working dashboard instead of a report builder. Field ids are
// table-qualified (`disputes.id`); unqualified ids do not resolve.
const initialReport: AgReportState = {
  selectedPageId: 'page-disputes',
  pages: [
    {
      id: 'page-disputes',
      layout: { columns: 24, rowHeight: 44, widgetBorderEnabled: true, widgetBorderRadius: 8 },
      widgets: {
        'widget-count': {
          type: 'value',
          format: { title: { text: 'Disputes', enabled: true } },
          dataMapping: { value: [{ id: 'disputes.id', aggregation: 'count' }] },
        },
      },
      widgetLayout: {
        'widget-count': { xTrack: 0, yTrack: 0, xSpan: 8, ySpan: 3 },
      },
    },
  ],
};

export const StudioCanvas: React.FC<{ data: StudioData }> = ({ data }) => {
  const [mode, setMode] = useState<'view' | 'edit'>('view');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
        <Button
          testId="studio-mode-button"
          variant="secondary"
          onClick={() => setMode(mode === 'view' ? 'edit' : 'view')}
        >
          {mode === 'view' ? 'Edit layout' : 'Done editing'}
        </Button>
      </div>
      <div
        style={{
          height: '640px',
          border: `1px solid ${colors.border}`,
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        <AgStudio
          data={data}
          mode={mode}
          initialState={initialReport}
          theme={studioTheme}
          style={{ height: '100%', width: '100%' }}
        />
      </div>
    </div>
  );
};
