/**
 * Storefront Root Application.
 *
 * Implements Step 31 storefront requirements:
 * - Persistent sandbox banner with test buyer credentials and links
 * - Warm theme using shared UI components
 * - Catalog, Product detail, Cart, Checkout, Confirmation pages
 * - Demo order fast-track shortcut
 */

import React from 'react';
import { DemoOrderShortcut } from './components/DemoOrderShortcut';
import { ShopBanner } from './components/ShopBanner';
import { CartProvider, useCart } from './CartContext';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { ConfirmationPage } from './pages/ConfirmationPage';
import { HomePage } from './pages/HomePage';
import { ProductPage } from './pages/ProductPage';
import {
  BuyerDisputePage,
  OrderDetailPage,
  OrderLookupPage,
  ReportProblemPage,
} from './portal';
import { Link, RouterProvider, useRouter } from './router';
import { warmColors, warmShadows } from './theme';

const ShopHeader: React.FC = () => {
  const { itemCount } = useCart();

  return (
    <header
      style={{
        backgroundColor: warmColors.surface,
        borderBottom: `1px solid ${warmColors.border}`,
        boxShadow: warmShadows.sm,
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Link to="/" testId="shop-brand-logo" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '24px' }}>🕯️</span>
          <div>
            <div
              style={{
                fontSize: '20px',
                fontWeight: 700,
                color: warmColors.ink,
                letterSpacing: '-0.02em',
              }}
            >
              Luminary Candles
            </div>
            <div style={{ fontSize: '11px', color: warmColors.inkMuted }}>
              Artisan soy candles & buyer portal
            </div>
          </div>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link
            to="/"
            testId="shop-nav-catalog-link"
            style={{
              fontSize: '14px',
              fontWeight: 500,
              color: warmColors.ink,
              padding: '6px 12px',
              borderRadius: '6px',
            }}
          >
            Catalog
          </Link>

          <Link
            to="/orders"
            testId="shop-nav-portal-link"
            style={{
              fontSize: '14px',
              fontWeight: 500,
              color: warmColors.ink,
              padding: '6px 12px',
              borderRadius: '6px',
            }}
          >
            Track Order
          </Link>

          <DemoOrderShortcut
            variant="secondary"
            label="⚡ Demo Order"
            testId="shop-header-demo-order-btn"
          />

          <Link
            to="/cart"
            testId="shop-cart-button"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '8px',
              backgroundColor: warmColors.primary,
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            <span>Cart</span>
            <span
              data-testid="shop-cart-badge"
              style={{
                backgroundColor: warmColors.primaryHover,
                color: '#ffffff',
                padding: '2px 8px',
                borderRadius: '9999px',
                fontSize: '12px',
                minWidth: '16px',
                textAlign: 'center',
              }}
            >
              {itemCount}
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
};

const ShopContent: React.FC = () => {
  const { path, params } = useRouter();

  let pageContent: React.ReactNode;

  if (path === '/') {
    pageContent = <HomePage />;
  } else if (path === '/product/:sku' && params.sku) {
    pageContent = <ProductPage sku={params.sku} />;
  } else if (path === '/cart') {
    pageContent = <CartPage />;
  } else if (path === '/checkout') {
    pageContent = <CheckoutPage />;
  } else if (path === '/confirmation/:code' && params.code) {
    pageContent = <ConfirmationPage orderCode={params.code} />;
  } else if (path === '/orders') {
    pageContent = <OrderLookupPage />;
  } else if (path === '/orders/:code/dispute/new' && params.code) {
    pageContent = <ReportProblemPage orderCode={params.code} />;
  } else if (path === '/orders/:code/dispute' && params.code) {
    pageContent = <BuyerDisputePage orderCode={params.code} />;
  } else if (path === '/orders/:code' && params.code) {
    pageContent = <OrderDetailPage orderCode={params.code} />;
  } else {
    pageContent = <HomePage />;
  }

  return <main style={{ minHeight: 'calc(100vh - 200px)' }}>{pageContent}</main>;
};

const ShopFooter: React.FC = () => (
  <footer
    style={{
      backgroundColor: warmColors.surfaceMuted,
      borderTop: `1px solid ${warmColors.border}`,
      padding: '32px 20px',
      marginTop: '60px',
      textAlign: 'center',
      color: warmColors.inkMuted,
      fontSize: '13px',
    }}
  >
    <div style={{ maxWidth: '800px', margin: '0 auto', lineHeight: 1.6 }}>
      <p style={{ margin: '0 0 8px 0', fontWeight: 600, color: warmColors.ink }}>
        Luminary Candles · Fictional Demonstration Storefront
      </p>
      <p style={{ margin: 0 }}>
        Powered by Signoff dispute resolution demo. Connected exclusively to PayPal Sandbox.
        No real transactions or real goods are processed.
      </p>
    </div>
  </footer>
);

export const App: React.FC = () => {
  return (
    <RouterProvider>
      <CartProvider>
        <div
          style={{
            backgroundColor: warmColors.bg,
            color: warmColors.ink,
            minHeight: '100vh',
            fontFamily:
              "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
          }}
        >
          <ShopBanner />
          <ShopHeader />
          <ShopContent />
          <ShopFooter />
        </div>
      </CartProvider>
    </RouterProvider>
  );
};
