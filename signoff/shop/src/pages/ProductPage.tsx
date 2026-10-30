/**
 * Product detail page.
 *
 * Implements Step 2, Rule 3:
 * - Image left, details right on desktop; stacked on mobile.
 * - Add to cart is the only dark button on the page.
 * - Warm retail treatment: #FFFFFF background, 8px radius, subtle shadow.
 */

import React, { useEffect, useState } from 'react';
import { Button, Card, ErrorState, Money, Skeleton } from '@signoff/ui';
import { fetchProduct } from '../api';
import { useCart } from '../CartContext';
import { Link, useRouter } from '../router';
import { colors, retailTheme } from '../theme';
import type { Product } from '../types';

export const ProductPage: React.FC<{ sku: string }> = ({ sku }) => {
  const { getProduct, addToCart } = useCart();
  const { navigate } = useRouter();

  const [product, setProduct] = useState<Product | undefined>(() => getProduct(sku));
  const [quantity, setQuantity] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(!product);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<boolean>(false);

  useEffect(() => {
    const cached = getProduct(sku);
    if (cached) {
      setProduct(cached);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    fetchProduct(sku)
      .then(p => {
        if (active) {
          setProduct(p);
          setLoading(false);
        }
      })
      .catch(err => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Product not found');
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [sku, getProduct]);

  const handleAddToCart = () => {
    if (!product) return;
    addToCart(product.sku, quantity);
    setAdded(true);
  };

  if (loading) {
    return (
      <div style={{ maxWidth: '960px', margin: '40px auto', padding: '0 16px' }}>
        <Card testId="shop-product-loading">
          <Skeleton width="40%" height="32px" />
          <div style={{ marginTop: '16px' }}>
            <Skeleton width="100%" height="160px" />
          </div>
        </Card>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div style={{ maxWidth: '960px', margin: '40px auto', padding: '0 16px' }}>
        <ErrorState
          message={error || `Could not find product with SKU "${sku}".`}
          onRetry={() => navigate('/')}
          testId="shop-back-catalog-btn"
        />
      </div>
    );
  }

  const initial = product.name ? product.name.charAt(0).toUpperCase() : 'C';

  return (
    <div
      style={{
        backgroundColor: retailTheme.pageBg,
        minHeight: '100vh',
        padding: '32px 16px',
        fontFamily: retailTheme.fontFamily,
      }}
    >
      <style>{`
        .product-detail-layout {
          display: grid;
          grid-template-columns: 1fr;
          gap: 36px;
        }
        @media (min-width: 768px) {
          .product-detail-layout {
            grid-template-columns: 1fr 1fr;
            align-items: start;
          }
        }
      `}</style>

      <div style={{ maxWidth: '960px', margin: '0 auto' }}>
        <nav style={{ marginBottom: '24px' }}>
          <Link
            to="/"
            testId="shop-breadcrumb-home"
            style={{ color: retailTheme.inkMuted, fontSize: '13px', textDecoration: 'underline' }}
          >
            ← Back to candles
          </Link>
        </nav>

        <div
          data-testid="shop-product-detail"
          className="product-detail-layout"
          style={{
            backgroundColor: '#FFFFFF',
            padding: '32px',
            borderRadius: '8px',
            boxShadow: retailTheme.cardShadow,
          }}
        >
          {/* Left on desktop / top on mobile: Square image area */}
          <div
            style={{
              aspectRatio: '1 / 1',
              width: '100%',
              backgroundColor: retailTheme.imageBg,
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              userSelect: 'none',
            }}
          >
            <span
              style={{
                fontFamily: retailTheme.serifFont,
                fontSize: '96px',
                color: colors.ink,
                lineHeight: 1,
              }}
            >
              {initial}
            </span>
            <span
              data-testid="shop-product-sku"
              style={{
                fontSize: '12px',
                fontFamily: 'monospace',
                color: retailTheme.inkMuted,
                marginTop: '16px',
              }}
            >
              SKU: {product.sku}
            </span>
          </div>

          {/* Right on desktop / bottom on mobile: Details */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h1
              data-testid="shop-product-title"
              style={{
                margin: '0 0 12px 0',
                fontSize: '24px',
                fontWeight: 700,
                color: retailTheme.ink,
                fontFamily: retailTheme.serifFont,
              }}
            >
              {product.name}
            </h1>

            <div
              style={{
                fontSize: '20px',
                fontWeight: 600,
                color: retailTheme.ink,
                marginBottom: '16px',
              }}
            >
              <Money money={product.price} testId="shop-product-detail-price" />
            </div>

            <p
              data-testid="shop-product-description"
              style={{
                fontSize: '14px',
                color: retailTheme.inkMuted,
                lineHeight: 1.6,
                margin: '0 0 24px 0',
              }}
            >
              {product.description}
            </p>

            <div
              style={{
                paddingTop: '20px',
                borderTop: `1px solid ${retailTheme.borderSubtle}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <label
                  htmlFor="product-quantity"
                  style={{ fontSize: '13px', fontWeight: 600, color: retailTheme.ink }}
                >
                  Quantity:
                </label>
                <select
                  id="product-quantity"
                  data-testid="shop-quantity-select"
                  value={quantity}
                  onChange={e => setQuantity(Number(e.target.value))}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: `1px solid ${retailTheme.borderSubtle}`,
                    fontSize: '13px',
                    backgroundColor: '#FFFFFF',
                    color: retailTheme.ink,
                  }}
                >
                  {[1, 2, 3, 4, 5].map(q => (
                    <option key={q} value={q}>
                      {q}
                    </option>
                  ))}
                </select>
              </div>

              {/* Add to cart is the only dark button on the page */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <Button
                  variant="primary"
                  onClick={handleAddToCart}
                  testId="shop-add-to-cart-btn"
                >
                  {added ? 'Added to Cart ✓' : 'Add to cart'}
                </Button>
                {added && (
                  <Link
                    to="/cart"
                    testId="shop-view-cart-btn"
                    style={{
                      fontSize: '13px',
                      color: retailTheme.inkMuted,
                      textDecoration: 'underline',
                    }}
                  >
                    View cart ({quantity}) →
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
