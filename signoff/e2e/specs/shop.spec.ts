import { expect, test } from '@playwright/test';

test.describe('Storefront E2E (Step 31)', () => {
  test.use({
    baseURL: process.env.SHOP_URL ?? 'http://localhost:5174',
  });

  test('add to cart, pay via sandbox, and confirm order', async ({ page }) => {
    // 1. Visit storefront home
    await page.goto('/');
    await expect(page.getByTestId('shop-banner')).toBeVisible();
    await expect(page.getByTestId('shop-banner-text')).toContainText('Demo store. Payments use the PayPal sandbox. No real money moves.');

    // 2. Inspect banner collapsible details
    const howToPayBtn = page.getByTestId('shop-banner-how-to-pay-toggle');
    await howToPayBtn.click();
    await expect(page.getByTestId('shop-banner-how-to-pay-content')).toBeVisible();
    await expect(page.getByTestId('shop-buyer-email')).toHaveText('alex.morgan@example.test');

    // 3. Add item to cart
    await expect(page.getByTestId('shop-catalog-grid')).toBeVisible();
    await page.getByTestId('shop-view-product-CND-LAV-01').click();
    const addBtn = page.getByTestId('shop-add-to-cart-btn');
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    // 4. Cart badge updates to 1
    const cartBadge = page.getByTestId('shop-cart-badge');
    await expect(cartBadge).toHaveText('1');

    // 5. Navigate to cart page
    await page.getByTestId('shop-cart-button').click();
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByTestId('shop-cart-row-CND-LAV-01')).toBeVisible();

    // 6. Proceed to checkout
    const checkoutBtn = page.getByTestId('shop-checkout-btn');
    await expect(checkoutBtn).toBeVisible();
    await checkoutBtn.click();
    await expect(page).toHaveURL(/\/checkout$/);
    await expect(page.getByTestId('shop-checkout-container')).toBeVisible();

    // 7. Pay with Sandbox
    const payBtn = page.getByTestId('shop-sandbox-pay-btn');
    await expect(payBtn).toBeVisible();
    await payBtn.click();

    // 8. Order confirmation page
    await expect(page).toHaveURL(/\/confirmation\/SIG/);
    await expect(page.getByTestId('shop-confirmation-card')).toBeVisible();
    await expect(page.getByTestId('shop-confirmation-title')).toContainText('Thank you for your order');
    await expect(page.getByTestId('shop-order-code')).toContainText('SIG');
  });

  test('cancel path returns to intact cart', async ({ page }) => {
    await page.goto('/');

    // Add item to cart
    await expect(page.getByTestId('shop-catalog-grid')).toBeVisible();
    await page.getByTestId('shop-view-product-CND-VAN-02').click();
    await page.getByTestId('shop-add-to-cart-btn').click();
    await expect(page.getByTestId('shop-cart-badge')).toHaveText('1');

    // Go to cart then checkout
    await page.getByTestId('shop-cart-button').click();
    await page.getByTestId('shop-checkout-btn').click();
    await expect(page).toHaveURL(/\/checkout$/);

    // Cancel / return to cart
    await page.getByTestId('shop-back-to-cart-link').click();
    await expect(page).toHaveURL(/\/cart$/);

    // Cart is intact
    await expect(page.getByTestId('shop-cart-row-CND-VAN-02')).toBeVisible();
    await expect(page.getByTestId('shop-cart-badge')).toHaveText('1');
  });

  test('request-tampering test: changing price in intercepted request is ignored; server price is used', async ({
    page,
  }) => {
    // Intercept POST /api/shop/orders and attempt to tamper with the price
    await page.route('**/api/shop/orders', async (route) => {
      const request = route.request();
      if (request.method() === 'POST' && !request.url().includes('/capture')) {
        const postData = request.postDataJSON() || {};
        // Attempt price-tampering by attaching a malicious 1 cent price to the payload
        const tamperedData = {
          ...postData,
          tampered_price: '0.01',
          items: (postData.items || []).map((it: Record<string, unknown>) => ({
            ...it,
            price: '0.01',
            unit_price: '0.01',
          })),
        };
        await route.continue({ postData: JSON.stringify(tamperedData) });
      } else {
        await route.continue();
      }
    });

    await page.goto('/');
    await expect(page.getByTestId('shop-catalog-grid')).toBeVisible();

    // Add CND-LAV-01 ($21.00 official catalog price)
    await page.getByTestId('shop-view-product-CND-LAV-01').click();
    await page.getByTestId('shop-add-to-cart-btn').click();
    await page.getByTestId('shop-cart-button').click();
    await page.getByTestId('shop-checkout-btn').click();

    // Complete payment
    await page.getByTestId('shop-sandbox-pay-btn').click();

    // Verify confirmation uses server price ($21.00, NOT $0.01)
    await expect(page).toHaveURL(/\/confirmation\/SIG/);
    await expect(page.getByTestId('shop-confirmation-card')).toBeVisible();
    // Price rendered via <Money> component must match catalog value
    const amountElem = page.getByTestId('shop-order-amount');
    await expect(amountElem).toContainText('USD 21.00');
    await expect(amountElem).not.toContainText('0.01');
  });
});
