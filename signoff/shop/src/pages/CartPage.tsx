/**
 * Cart review page.
 */

import React from 'react';
import { Button, EmptyState, Money } from '@signoff/ui';
import { DemoOrderShortcut } from '../components/DemoOrderShortcut';
import { useCart } from '../CartContext';
import { Link, useRouter } from '../router';
import { warmColors, warmShadows } from '../theme';

export const CartPage: React.FC = () => {
  const { items, catalog, subtotal, updateQuantity, removeFromCart, clearCart } = useCart();
  const { navigate } = useRouter();

  if (items.length === 0) {
    return (
      <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 16px' }}>
        <div data-testid="shop-empty-cart">
          <EmptyState
            title="Your cart is empty"
            description="Explore our collection of hand-poured artisan candles."
            action={
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '16px' }}>
                <Button variant="primary" onClick={() => navigate('/')} testId="shop-browse-btn">
                  Browse Catalog
                </Button>
                <DemoOrderShortcut />
              </div>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '900px', margin: '40px auto', padding: '0 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, margin: 0, color: warmColors.ink }}>
          Shopping Cart
        </h1>
        <button
          type="button"
          onClick={clearCart}
          data-testid="shop-clear-cart-btn"
          style={{
            background: 'none',
            border: 'none',
            color: warmColors.inkMuted,
            fontSize: '13px',
            textDecoration: 'underline',
            cursor: 'pointer',
          }}
        >
          Clear cart
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '24px',
        }}
      >
        <div
          data-testid="shop-cart-items-table"
          style={{
            backgroundColor: warmColors.surface,
            borderRadius: '12px',
            border: `1px solid ${warmColors.border}`,
            boxShadow: warmShadows.sm,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '16px 20px',
              backgroundColor: warmColors.surfaceMuted,
              borderBottom: `1px solid ${warmColors.border}`,
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr auto',
              fontSize: '13px',
              fontWeight: 600,
              color: warmColors.inkMuted,
            }}
          >
            <div>Item</div>
            <div style={{ textAlign: 'center' }}>Quantity</div>
            <div style={{ textAlign: 'right' }}>Price</div>
            <div style={{ width: '40px' }} />
          </div>

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
                  padding: '20px',
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr auto',
                  alignItems: 'center',
                  borderBottom: `1px solid ${warmColors.borderMuted}`,
                }}
              >
                <div>
                  <Link
                    to={`/product/${item.sku}`}
                    style={{ fontWeight: 600, color: warmColors.ink, fontSize: '15px' }}
                  >
                    {name}
                  </Link>
                  <div style={{ fontSize: '12px', color: warmColors.inkSubtle, marginTop: '2px' }}>
                    SKU: {item.sku}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.sku, item.quantity - 1)}
                    data-testid={`shop-qty-minus-${item.sku}`}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '4px',
                      border: `1px solid ${warmColors.border}`,
                      backgroundColor: warmColors.surface,
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                    aria-label="Decrease quantity"
                  >
                    -
                  </button>
                  <span
                    data-testid={`shop-qty-val-${item.sku}`}
                    style={{ fontWeight: 600, minWidth: '20px', textAlign: 'center' }}
                  >
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.sku, item.quantity + 1)}
                    disabled={item.quantity >= 5}
                    data-testid={`shop-qty-plus-${item.sku}`}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '4px',
                      border: `1px solid ${warmColors.border}`,
                      backgroundColor: item.quantity >= 5 ? warmColors.surfaceMuted : warmColors.surface,
                      cursor: item.quantity >= 5 ? 'not-allowed' : 'pointer',
                      fontWeight: 600,
                    }}
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>

                <div style={{ textAlign: 'right', fontWeight: 600, color: warmColors.accent }}>
                  <Money money={lineTotal} testId={`shop-item-total-${item.sku}`} />
                </div>

                <div style={{ textAlign: 'right', width: '40px' }}>
                  <button
                    type="button"
                    onClick={() => removeFromCart(item.sku)}
                    data-testid={`shop-remove-item-${item.sku}`}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: warmColors.inkMuted,
                      cursor: 'pointer',
                      fontSize: '16px',
                    }}
                    aria-label="Remove item"
                    title="Remove item"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Order Summary & Actions */}
        <div
          style={{
            backgroundColor: warmColors.surface,
            borderRadius: '12px',
            border: `1px solid ${warmColors.border}`,
            boxShadow: warmShadows.sm,
            padding: '24px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '18px',
              fontWeight: 700,
              marginBottom: '20px',
              paddingBottom: '16px',
              borderBottom: `1px solid ${warmColors.borderMuted}`,
            }}
          >
            <span>Subtotal:</span>
            <span style={{ color: warmColors.accent }}>
              <Money money={subtotal} testId="shop-cart-subtotal" />
            </span>
          </div>

          <p style={{ fontSize: '13px', color: warmColors.inkMuted, margin: '0 0 20px 0' }}>
            Taxes and shipping computed during checkout. Prices verified directly with server catalog.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
            <Link to="/" style={{ color: warmColors.primary, fontSize: '14px', fontWeight: 500 }}>
              ← Continue Shopping
            </Link>

            <div style={{ display: 'flex', gap: '12px' }}>
              <DemoOrderShortcut variant="secondary" />
              <Button
                variant="primary"
                onClick={() => navigate('/checkout')}
                testId="shop-checkout-btn"
              >
                Proceed to Checkout →
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
