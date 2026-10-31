import { expect, test } from './fixtures';
import { AGENT_URL, createScenario, hasKind, waitForTimeline } from './helpers/agent';
import { stub } from './helpers/stub';

interface Kpis {
  open_disputes: number;
  dollars_at_risk: string;
  share_auto_resolved: number | null;
}

test('B: small dispute auto-handled without approval @smoke @full', async ({ page, request, session }) => {
  const before: Kpis = await (await request.get(`${AGENT_URL}/api/kpis`)).json();

  const { disputeId } = await createScenario(request, 'B', session.id);
  await stub.emit(request, disputeId, ['CUSTOMER.DISPUTE.CREATED']);
  const items = await waitForTimeline(request, disputeId, (events) => hasKind(events, 'EXECUTION_CONFIRMED'));

  expect(hasKind(items, 'APPROVAL_REQUESTED')).toBe(false);

  const after: Kpis = await (await request.get(`${AGENT_URL}/api/kpis`)).json();
  expect(after.open_disputes).toBeGreaterThan(before.open_disputes);
  expect(Number(after.dollars_at_risk)).toBeGreaterThan(Number(before.dollars_at_risk));

  await session.applyTo(page);
  await page.goto('/app');
  await expect(page.getByTestId('dashboard-title')).toBeVisible();
  await expect(page.getByTestId(`dashboard-dispute-row-${disputeId}`)).toBeVisible();
  await expect(page.getByTestId('kpi-open-disputes')).toHaveText(String(after.open_disputes));
  await expect(page.getByTestId('kpi-autonomous-share')).toBeVisible();
  await expect(page.getByTestId('kpi-autonomous-share')).toHaveText(
    after.share_auto_resolved === null ? '—' : `${Math.round(after.share_auto_resolved * 100)}%`
  );
});
