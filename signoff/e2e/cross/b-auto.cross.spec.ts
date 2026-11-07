import { expect, test } from './fixtures';
import { AGENT_URL, createScenario, hasKind, waitForTimeline } from './helpers/agent';
import { stub } from './helpers/stub';

interface Kpis {
  open_disputes: number;
  dollars_at_risk: string;
  share_auto_resolved: number | null;
}

test('B: in-transit dispute requires review by default @smoke @full', async ({ page, request, session }) => {
  const before: Kpis = await (await request.get(`${AGENT_URL}/api/kpis`)).json();

  const { disputeId } = await createScenario(request, 'B', session.id);
  await stub.emit(request, disputeId, ['CUSTOMER.DISPUTE.CREATED']);
  const items = await waitForTimeline(request, disputeId, (events) =>
    hasKind(events, 'APPROVAL_REQUESTED'));

  expect(hasKind(items, 'APPROVAL_REQUESTED')).toBe(true);
  expect(hasKind(items, 'EXECUTION_INTENDED')).toBe(false);
  expect(hasKind(items, 'EXECUTION_CONFIRMED')).toBe(false);

  const after: Kpis = await (await request.get(`${AGENT_URL}/api/kpis`)).json();
  expect(after.open_disputes).toBeGreaterThan(before.open_disputes);
  expect(Number(after.dollars_at_risk)).toBeGreaterThan(Number(before.dollars_at_risk));

  await session.applyTo(page);
  await page.goto('/app');
  await expect(page.getByTestId('dashboard-title')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Open dispute summary' })).toContainText(String(after.open_disputes));
  await expect(page.getByRole('region', { name: 'Needs attention' }).locator(`a[href="/app/disputes/${disputeId}"]`)).toBeVisible();
  await page.goto('/app/reports');
  const reportKpis: Kpis = await (await request.get(`${AGENT_URL}/api/kpis?scope=mine`, {
    headers: { 'X-Demo-Session': session.id },
  })).json();
  await expect(page.getByTestId('kpi-open-disputes')).toHaveText(String(reportKpis.open_disputes));
  await expect(page.getByTestId('kpi-autonomous-share')).toBeVisible();
  await expect(page.getByTestId('kpi-autonomous-share')).toHaveText(
    reportKpis.share_auto_resolved === null ? '—' : `${Math.round(reportKpis.share_auto_resolved * 100)}%`
  );
  await page.goto(`/app/disputes/${disputeId}`);
  await expect(page.getByTestId('open-approval-card-button')).toBeVisible();
  await expect(page.getByTestId('agent-in-progress-banner')).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('open-approval-card-button')).toBeVisible();
  await page.goto(`/app/disputes?q=${encodeURIComponent(disputeId)}`);
  await expect(page.locator(`a[href="/app/disputes/${disputeId}"]`)).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId('dispute-detail-id')).toContainText(disputeId);
  await expect(page.getByTestId('open-approval-card-button')).toBeVisible();
  await page.getByTestId('open-approval-card-button').click();
  await expect(page.getByTestId('approval-approve-button')).toBeVisible();
  await expect(page.getByTestId('proposed-action-type')).toContainText('ACCEPT CLAIM');
});
