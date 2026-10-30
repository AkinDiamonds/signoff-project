/**
 * Cart page with single-column summary.
 *
 * Implements Step 2, Rule 5 & Step 3:
 * - Single-column summary layout with one checkout button
 * - Above the checkout button: one-line summary "2 items · USD 42.00"
 * - Button reads "Pay with PayPal" and leads to the checkout moment
 */

import React from 'react';
import { Button, EmptyState, Money } from '@signoff/ui';
import { DemoOrderShortcut } from '../components/DemoOrderShortcut';
import { useCart } from '../CartContext';
import { Link, useRouter } from '../router';
import { retailTheme } from '../theme';

export const CartPage: React.FC = () => {
  const { items, catalog, subtotal, updateQuantity, removeFromCart, clearCart } = useCart();
  const { navigate } = useRouter();

  const totalCount = items.reduce((sum, it) => sum + it.quantity, 0);

  if (items.length === 0) {
    return (
      <div
        style={{
          backgroundColor: retailTheme.pageBg,
          minHeight: '100vh',
          padding: '40px 16px',
          fontFamily: retailTheme.fontFamily,
        }}
      >
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <div data-testid="shop-empty-cart">
            <EmptyState
              title="Your cart is empty"
              description="Explore our hand-poured artisan candles."
              action={
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '16px' }}>
                  <Button variant="primary" onClick={() => navigate('/')} testId="shop-browse-btn">
                    Browse Candles
                  </Button>
                  <DemoOrderShortcut />
                </div>
              }
            />
          </div>
        </div>
      </div>
    );
  }

  const summaryLineText = `${totalCount} ${totalCount === 1 ? 'item' : 'items'} · ${subtotal.currency_code} ${subtotal.value}`;

  return (
    <div
      style={{
        backgroundColor: retailTheme.pageBg,
        minHeight: '100vh',
        padding: '36px 16px',
        fontFamily: retailTheme.fontFamily,
      }}
    >
      <div style={{ maxWidth: '680px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <h1
            style={{
              fontSize: '24px',
              fontWeight: 700,
              margin: 0,
              color: retailTheme.ink,
              fontFamily: retailTheme.serifFont,
            }}
          >
            Shopping Cart
          </h1>
          <button
            type="button"
            onClick={clearCart}
            data-testid="shop-clear-cart-btn"
            style={{
              background: 'none',
              border: 'none',
              color: retailTheme.inkMuted,
              fontSize: '12px',
              textDecoration: 'underline',
              cursor: 'pointer',
            }}
          >
            Clear cart
          </button>
        </div>

        {/* Single-column summary container with subtle shadow */}
        <div
          data-testid="shop-cart-items-table"
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '8px',
            boxShadow: retailTheme.cardShadow,
            padding: '24px',
            marginBottom: '24px',
          }}
        >
          {items.map(item => {
            const product = catalog[item.sku];
            const name = product ? product.name : item.sku;
            const unitPrice = product ? product.price : { value: '0.00', currency_code: 'USD' };
            const lineTotalCents = Math.round(parseFloat(unitPrice.value) * 100) * item.quantity;
            const lineTotal = {
              value: (lineTotalCents / 100).toFixed(2),
              currency_code: 'USD',
            };

            return (
              <div
                key={item.sku}
                data-testid={`shop-cart-row-${item.sku}`}
                style={{
                  padding: '16px 0',
                  display: 'grid',
                  gridTemplateColumns: '1fr auto auto auto',
                  alignItems: 'center',
                  gap: '16px',
                  borderBottom: `1px solid ${retailTheme.borderSubtle}`,
                }}
              >
                <div>
                  <Link
                    to={`/product/${item.sku}`}
                    style={{ fontWeight: 600, color: retailTheme.ink, fontSize: '14px', textDecoration: 'none' }}
                  >
                    {name}
                  </Link>
                  <div style={{ fontSize: '12px', color: retailTheme.inkMuted, marginTop: '2px' }}>
                    SKU: {item.sku}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.sku, item.quantity - 1)}
                    data-testid={`shop-qty-minus-${item.sku}`}
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '4px',
                      border: `1px solid ${retailTheme.borderSubtle}`,
                      backgroundColor: '#FFFFFF',
                      cursor: 'pointer',
                      fontSize: '14px',
                      lineHeight: '22px',
                    }}
                    aria-label="Decrease quantity"
                  >
                    -
                  </button>
                  <span
                    data-testid={`shop-qty-val-${item.sku}`}
                    style={{ fontSize: '13px', fontWeight: 600, minWidth: '16px', textAlign: 'center' }}
                  >
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.sku, item.quantity + 1)}
                    disabled={item.quantity >= 5}
                    data-testid={`shop-qty-plus-${item.sku}`}
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '4px',
                      border: `1px solid ${retailTheme.borderSubtle}`,
                      backgroundColor: item.quantity >= 5 ? retailTheme.surfaceWarm : '#FFFFFF',
                      cursor: item.quantity >= 5 ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      lineHeight: '22px',
                    }}
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>

                <div style={{ textAlign: 'right', fontWeight: 600, fontSize: '14px', color: retailTheme.ink }}>
                  <Money money={lineTotal} testId={`shop-item-total-${item.sku}`} />
                </div>

                <button
                  type="button"
                  onClick={() => removeFromCart(item.sku)}
                  data-testid={`shop-remove-item-${item.sku}`}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: retailTheme.inkMuted,
                    cursor: 'pointer',
                    fontSize: '14px',
                    padding: '4px',
                  }}
                  aria-label="Remove item"
                >
                  ✕
                </button>
              </div>
            );
          })}

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              paddingTop: '20px',
              fontSize: '15px',
              fontWeight: 600,
              color: retailTheme.ink,
            }}
          >
            <span>Subtotal</span>
            <span data-testid="shop-cart-subtotal">
              <Money money={subtotal} />
            </span>
          </div>
        </div>

        {/* Single Checkout Summary Card */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '8px',
            boxShadow: retailTheme.cardShadow,
            padding: '24px',
            textAlign: 'center',
          }}
        >
          {/* One-line summary above checkout button */}
          <div
            data-testid="shop-cart-one-line-summary"
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: retailTheme.ink,
              marginBottom: '16px',
            }}
          >
            {summaryLineText}
          </div>

          {/* Single checkout button: Pay with PayPal */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <Button
              variant="primary"
              onClick={() => navigate('/checkout')}
              testId="shop-checkout-btn"
            >
              Pay with PayPal
            </Button>
          </div>

          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Link to="/" style={{ color: retailTheme.inkMuted, fontSize: '13px', textDecoration: 'underline' }}>
              ← Continue shopping
            </Link>
            <DemoOrderShortcut variant="secondary" />
          </div>
        </div>
      </div>
    </div>
  );
};
