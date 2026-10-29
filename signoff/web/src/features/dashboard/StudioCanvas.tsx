import React, { useState } from 'react';
import { AgStudio } from 'ag-studio-react';
import {
  AgStudioModuleRegistry,
  AgStudioAiModule,
  createAiHarness,
  studioTheme as defaultStudioTheme,
} from 'ag-studio';
import type { AgReportState, AgAiPromptStarter, AgAiHarnessDefaults } from 'ag-studio';
import { Button, colors, typography } from '@signoff/ui';
import type { StudioData } from './types';
import { studioLlmAdapter } from './studioLlmAdapter';

// Register the AI module once at module load (idempotent).
AgStudioModuleRegistry.registerModules([AgStudioAiModule]);

const studioTheme = defaultStudioTheme.withParams({
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

// AG Studio grid widget renders zero rows in production build (not a duplicate-package artifact;
// .ag-body-viewport is null in DOM). Fall back to working value widgets carrying the same data.
// Recorded in build-plan/v2/decision-log.md (D11). Field ids are table-qualified (`disputes.id`).
const initialReport: AgReportState = {
  selectedPageId: 'page-disputes',
  pages: [
    {
      id: 'page-disputes',
      layout: { columns: 24, rowHeight: 44, widgetBorderEnabled: true, widgetBorderRadius: 8 },
      widgets: {
        'widget-open': {
          type: 'value',
          format: { title: { text: 'Open disputes', enabled: true } },
          dataMapping: { value: [{ id: 'disputes.id', aggregation: 'count' }] },
        },
        'widget-value': {
          type: 'value',
          format: { title: { text: 'Disputed value (cents)', enabled: true } },
          dataMapping: { value: [{ id: 'disputes.amount_cents', aggregation: 'sum' }] },
        },
        'widget-needs-approval': {
          type: 'value',
          format: { title: { text: 'Needs approval', enabled: true } },
          dataMapping: { value: [{ id: 'disputes.id', aggregation: 'count' }] },
        },
      },
      widgetLayout: {
        'widget-open': { xTrack: 0, yTrack: 0, xSpan: 8, ySpan: 3 },
        'widget-value': { xTrack: 8, yTrack: 0, xSpan: 8, ySpan: 3 },
        'widget-needs-approval': { xTrack: 16, yTrack: 0, xSpan: 8, ySpan: 3 },
      },
      filter: {
        widget: {
          'widget-needs-approval': [
            {
              field: { id: 'disputes.verdict' },
              model: { operator: 'equals', value: 'NEEDS_APPROVAL' },
            },
          ],
        },
      },
    },
  ],
};

const STUDIO_PROMPT_STARTERS: AgAiPromptStarter[] = [
  {
    label: 'How many disputes are open, and how much is at risk?',
    prompt: 'How many disputes are open, and how much is at risk?',
  },
  {
    label: 'Which disputes are due soon?',
    prompt: 'Which disputes are due soon?',
  },
  {
    label: 'What share of closed disputes was auto-resolved?',
    prompt: 'What share of closed disputes was auto-resolved?',
  },
  {
    label: 'Explain what happened on PP-D-1001.',
    prompt: 'Explain what happened on PP-D-1001.',
  },
];

const STUDIO_AI_DEFAULTS: AgAiHarnessDefaults = {
  adapter: studioLlmAdapter,
  primary: 'lead',
  promptStarters: STUDIO_PROMPT_STARTERS,
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
          ai={({ api }) => createAiHarness(api, STUDIO_AI_DEFAULTS)}
          panels={{
            edit: {
              right: ['ai'],
            },
          }}
        />
      </div>
    </div>
  );
};
