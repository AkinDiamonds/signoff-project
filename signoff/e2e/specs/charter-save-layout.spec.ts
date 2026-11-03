import { expect, test } from '@playwright/test';

test('save controls and mobile navigation remain separate', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'merchant-mobile');
  for (const width of [320, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 700 });
    await page.goto('/app/policy');
    await expect(page.getByTestId('charter-title')).toBeVisible();
    await page.getByLabel('Auto-offer maximum (USD)').fill('30');
    const save = page.getByTestId('charter-save-button');
    await save.scrollIntoViewIfNeeded();
    const bar = await page.getByTestId('charter-sticky-save-bar').boundingBox();
    const nav = await page.getByRole('navigation', { name: 'Main navigation' }).boundingBox();
    expect(bar).not.toBeNull();
    expect(nav).not.toBeNull();
    if (bar && nav) expect(bar.y + bar.height).toBeLessThanOrEqual(nav.y);
    await expect(save).toBeEnabled();
  }
});


test('unsaved signing limits can be kept or discarded during navigation', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'merchant-mobile');
  await page.goto('/app/policy');
  await page.getByLabel('Auto-offer maximum (USD)').fill('30');
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'More' }).click();
  await expect(page.getByRole('dialog', { name: 'Discard unsaved changes?' })).toBeVisible();
  await page.getByRole('button', { name: 'Keep editing' }).click();
  await expect(page.getByLabel('Auto-offer maximum (USD)')).toHaveValue('30');
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'More' }).click();
  await page.getByRole('button', { name: 'Discard changes' }).click();
  await expect(page).toHaveURL(/\/app\/more$/);
});


test('dispute filters apply to the URL only after confirmation', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'merchant-mobile');
  await page.goto('/app/disputes');
  await page.getByRole('button', { name: 'Filter' }).click();
  await page.getByLabel('Status').selectOption('RESOLVED');
  await expect(page).not.toHaveURL(/status=/);
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await expect(page).toHaveURL(/status=RESOLVED/);
});

test('session filter never broadens an absent demo session', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'merchant-mobile');
  await page.goto('/app/disputes');
  await page.getByRole('button', { name: 'Filter' }).click();
  await page.getByLabel('My demo session').check();
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await expect(page).toHaveURL(/scope=mine/);
  await expect(page.getByText('No active demo session')).toBeVisible();
});

test('dispute views persist in the URL and show a view-specific empty state', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'merchant-mobile');
  await page.goto('/app/disputes');
  await page.getByRole('button', { name: 'Waiting', exact: true }).click();
  await expect(page).toHaveURL(/view=waiting/);
  await expect(page.getByText('No disputes in this view')).toBeVisible();
});

test('search filters cases by order reference and persists in the URL', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'merchant-mobile');
  await page.goto('/app/disputes');
  await page.getByLabel('Search disputes').fill('ORD0000002');
  await expect(page).toHaveURL(/q=ORD0000002/);
  await expect(page.getByTestId('dispute-row-PP-D-1002')).toBeVisible();
  await expect(page.getByTestId('dispute-row-PP-D-1001')).toHaveCount(0);
});
