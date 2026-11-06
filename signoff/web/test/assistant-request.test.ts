import { describe, expect, it } from 'vitest';
import { kpisFixture, disputesFixture } from '../../fixtures/ui';
import { buildAssistantRequest } from '../src/features/dashboard/types';

describe('buildAssistantRequest', () => {
  it('keeps the message within the 4,000 character agent limit for large dispute lists', () => {
    const template = disputesFixture.items[0]!;
    const items = Array.from({ length: 50 }, (_, i) => ({ ...template, id: `PP-D-${2000 + i}` }));
    const { messages } = buildAssistantRequest('Which disputes are due soon?', kpisFixture, items);
    expect(messages).toHaveLength(1);
    expect(messages[0]!.content.length).toBeLessThanOrEqual(4000);
    expect(messages[0]!.content).toContain('Question: Which disputes are due soon?');
  });
});
