import { expect, test } from './fixtures';
import { approvalUrl, createScenario, hasKind, waitForTimeline } from './helpers/agent';
import { stub } from './helpers/stub';

test('E: repeat disputer requires approval on the third dispute @full', async ({ page, request, session }) => {
  const disputes: string[] = [];
  for (let index = 0; index < 3; index += 1) {
    const { disputeId } = await createScenario(request, 'E', session.id);
    disputes.push(disputeId);
    await stub.emit(request, disputeId, ['CUSTOMER.DISPUTE.CREATED']);
  }

  const third = disputes[2];
  const items = await waitForTimeline(request, third, (events) => hasKind(events, 'APPROVAL_REQUESTED'));
  const gate = items.find((item) => item.kind === 'GATE_DECIDED');
  expect(gate?.kind === 'GATE_DECIDED' ? gate.rule_id : '').toBe('G5-01');
  expect(gate?.kind === 'GATE_DECIDED' ? gate.verdict : '').toBe('NEEDS_APPROVAL');
  expect(hasKind(items, 'EXECUTION_SENT') || hasKind(items, 'EXECUTION_CONFIRMED')).toBe(false);

  const link = await approvalUrl(request, third);
  await session.applyTo(page);
  await page.goto(link);
  await expect(page.getByTestId('approval-title')).toBeVisible();
  await expect(page.getByTestId('approval-gate-reason-card')).toContainText('G5-01');
});
