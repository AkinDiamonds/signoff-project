import { describe, expect, it } from 'vitest';
import { kpisFixture, disputesFixture } from '../../fixtures/ui';
import { buildAssistantRequest } from '../src/features/dashboard/types';

describe('buildAssistantRequest', () => {
  it('keeps the message within the 4,000 character agent limit for large dispute lists', () => {
    const template = disputesFixture.items[0];
    if (!template) throw new Error('Expected a dispute fixture');
    const items = Array.from({ length: 50 }, (_, i) => ({ ...template, id: `PP-D-${2000 + i}` }));
    const { messages } = buildAssistantRequest('Which disputes are due soon?', kpisFixture, items);
    expect(messages).toHaveLength(1);
    const message = messages[0];
    if (!message) throw new Error('Expected an assistant message');
    expect(message.content.length).toBeLessThanOrEqual(4000);
    expect(message.content).toContain('Question: Which disputes are due soon?');
  });
});
