import { expect, test } from './fixtures';
import { AGENT_URL, BUYER_EMAIL, createBuyerDispute, hasKind, waitForTimeline } from './helpers/agent';
import { stub } from './helpers/stub';

// Stub-only local rehearsal. Real buyers open disputes separately in PayPal.
test('inbox persists new dispute and review notifications @full', async ({ page, request }) => {
  const createdResponse = await request.post(`${AGENT_URL}/api/shop/orders`, {
    data: { customer_email: BUYER_EMAIL, items: [{ sku: 'CND-CED-03', quantity: 1 }] },
  });
  expect(createdResponse.status()).toBe(201);
  const created: { order_code: string; paypal_order_id: string } = await createdResponse.json();
  const capture = await request.post(`${AGENT_URL}/api/shop/orders/${created.order_code}/capture`, {
    data: { paypal_order_id: created.paypal_order_id },
  });
  expect(capture.status()).toBe(200);
  const orderResponse = await request.get(
    `${AGENT_URL}/api/shop/orders/${created.order_code}?email=${encodeURIComponent(BUYER_EMAIL)}`,
  );
  const order: { amount: { value: string } } = await orderResponse.json();
  const disputeId = await createBuyerDispute(request, created.order_code, 'My order has not arrived.', order.amount.value);
  await stub.emit(request, disputeId, ['CUSTOMER.DISPUTE.CREATED']);
  const timeline = await waitForTimeline(request, disputeId, items => hasKind(items, 'NO_ACTION'));
  expect(hasKind(timeline, 'EXECUTION_INTENDED')).toBe(false);

  await page.goto('/app/notifications');
  await expect(page.getByRole('heading', { name: 'Updates' })).toBeVisible();
  const review = page.getByRole('listitem').filter({ hasText: 'A dispute needs your review.' }).first();
  await expect(review).toBeVisible();
  await expect(review.getByRole('link', { name: /View dispute/ })).toHaveAttribute('href', `/app/disputes/${disputeId}`);
  await review.getByRole('button', { name: 'Mark read' }).click();
  await expect(review.getByRole('button', { name: 'Mark unread' })).toBeVisible();
  await page.reload();
  await expect(review.getByRole('button', { name: 'Mark unread' })).toBeVisible();
  await review.getByRole('link', { name: /View dispute/ }).click();
  await expect(page.getByTestId('dispute-detail-id')).toContainText(disputeId);
  await expect(page.getByText('Delivery evidence needs your review')).toBeVisible();
  await page.goBack();
  await expect(review.getByRole('button', { name: 'Mark unread' })).toBeVisible();
});
