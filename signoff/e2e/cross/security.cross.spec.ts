import { expect, test } from './fixtures';
import {
  approvalUrl,
  createBuyerDispute,
  createShopOrder,
  hasKind,
  waitForTimeline,
} from './helpers/agent';
import { stub } from './helpers/stub';

const SHOP_URL = process.env.SHOP_URL ?? 'http://localhost:5174';
const WEB_URL = process.env.WEB_URL ?? 'http://localhost:5173';
const XSS = '<img src=x onerror=window.__xss=1>';

interface TamperedBody {
  price?: string;
  amount?: string;
  items: { sku: string; quantity: number; price?: string }[];
}

test('security: tampered order body cannot change the server total @full', async ({ browser, session }) => {
  const shopContext = await browser.newContext({ baseURL: SHOP_URL });
  const shop = await shopContext.newPage();
  await session.applyTo(shop);
  await shop.route('**/api/shop/orders', async (route) => {
    const body = route.request().postDataJSON() as TamperedBody;
    body.price = '0.01';
    body.amount = '0.01';
    body.items = body.items.map((item) => ({ ...item, price: '0.01' }));
    await route.continue({ postData: JSON.stringify(body) });
  });

  await shop.goto('/');
  await expect(shop.getByTestId('shop-catalog-grid')).toBeVisible();
  await shop.getByTestId('shop-header-demo-order-btn').click();
  await expect(shop.getByTestId('shop-order-details')).toContainText('USD 42.00');
  await expect(shop.getByTestId('shop-order-amount')).toContainText('42.00');
  await shopContext.close();
});

test('security: buyer message renders as inert text on detail and approval pages @full', async ({ page, request, session }) => {
  const orderCode = await createShopOrder(request, session.id, [{ sku: 'GIFT-SET-01', quantity: 3 }]);
  const disputeId = await createBuyerDispute(request, orderCode, XSS, '180.00');
  await stub.emit(request, disputeId, ['CUSTOMER.DISPUTE.CREATED']);
  await waitForTimeline(request, disputeId, (events) => hasKind(events, 'APPROVAL_REQUESTED'));

  await session.applyTo(page);
  await page.goto(`${WEB_URL}/app/disputes/${disputeId}`);
  await expect(page.getByTestId('buyer-message-content')).toContainText(XSS);
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();

  const link = await approvalUrl(request, disputeId);
  await page.goto(`${WEB_URL}${link}`);
  await expect(page.getByTestId('approval-buyer-message')).toContainText('<img');
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
});
