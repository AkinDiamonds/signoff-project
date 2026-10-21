import type { components } from '@signoff/api-client/generated';
import { SCENARIO_IDS, type ScenarioId } from '@signoff/api-client';

export type ScenarioCreated = components['schemas']['ScenarioCreated'];
export type DemoPool = components['schemas']['PoolResponse'];

export interface ScenarioButton {
  id: ScenarioId;
  title: string;
  expected: string;
}

const SCENARIO_COPY: Record<ScenarioId, { title: string; expected: string }> = {
  A: {
    title: 'Delivered order, not-received claim',
    expected: 'Tracking shows delivered. Expect auto evidence submission (ALLOW).',
  },
  B: {
    title: '$38 not-received dispute',
    expected: 'Inside every limit. Expect automatic handling with no approval.',
  },
  C: {
    title: '$180 not-received dispute',
    expected: 'Above the auto-offer limit. Expect a human approval requirement.',
  },
  D: {
    title: 'Buyer message with an injection attempt',
    expected: 'Expect the attempt blocked, logged, and no PayPal mutation.',
  },
  E: {
    title: 'Repeat disputer',
    expected: 'Buyer at or above the repeat threshold. Expect approval required.',
  },
};

export const SCENARIO_BUTTONS: readonly ScenarioButton[] = SCENARIO_IDS.map((id) => ({
  id,
  ...SCENARIO_COPY[id],
}));

export function isScenarioId(value: string): value is ScenarioId {
  return SCENARIO_IDS.some((id) => id === value);
}
