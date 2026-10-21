/**
 * Product detail page.
 */

import React, { useEffect, useState } from 'react';
import { Button, Card, ErrorState, Money, Skeleton } from '@signoff/ui';
import { fetchProduct } from '../api';
import { useCart } from '../CartContext';
import { Link, useRouter } from '../router';
import { warmColors, warmShadows } from '../theme';
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
      <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 16px' }}>
        <Card testId="shop-product-loading">
          <Skeleton width="40%" height="32px" />
          <div style={{ marginTop: '16px' }}>
            <Skeleton width="100%" height="120px" />
          </div>
        </Card>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 16px' }}>
        <ErrorState
          message={error || `Could not find product with SKU "${sku}".`}
          onRetry={() => navigate('/')}
          testId="shop-back-catalog-btn"
        />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '900px', margin: '40px auto', padding: '0 16px' }}>
      <nav style={{ marginBottom: '24px' }}>
        <Link
          to="/"
          testId="shop-breadcrumb-home"
          style={{ color: warmColors.primary, fontSize: '14px', fontWeight: 500 }}
        >
          ← Back to Catalog
        </Link>
      </nav>

      <div
        data-testid="shop-product-detail"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '32px',
          backgroundColor: warmColors.surface,
          padding: '32px',
          borderRadius: '16px',
          border: `1px solid ${warmColors.border}`,
          boxShadow: warmShadows.md,
        }}
      >
        {/* Visual box */}
        <div
          style={{
            height: '320px',
            backgroundColor: warmColors.surfaceMuted,
            borderRadius: '12px',
            border: `1px solid ${warmColors.borderMuted}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ fontSize: '72px', userSelect: 'none' }}>🕯️</span>
          <span
            data-testid="shop-product-sku"
            style={{
              fontSize: '12px',
              fontFamily: 'monospace',
              color: warmColors.inkSubtle,
              marginTop: '12px',
            }}
          >
            SKU: {product.sku}
          </span>
        </div>

        {/* Product details */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h1
            data-testid="shop-product-title"
            style={{
              margin: '0 0 12px 0',
              fontSize: '28px',
              fontWeight: 700,
              color: warmColors.ink,
            }}
          >
            {product.name}
          </h1>

          <div
            style={{
              fontSize: '24px',
              fontWeight: 700,
              color: warmColors.accent,
              marginBottom: '20px',
            }}
          >
            <Money money={product.price} testId="shop-product-detail-price" />
          </div>

          <p
            data-testid="shop-product-description"
            style={{
              fontSize: '15px',
              color: warmColors.inkMuted,
              lineHeight: 1.6,
              marginBottom: '24px',
              flex: 1,
            }}
          >
            {product.description}
          </p>

          <div
            style={{
              padding: '20px 0',
              borderTop: `1px solid ${warmColors.borderMuted}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <label
                htmlFor="product-quantity"
                style={{ fontSize: '14px', fontWeight: 600, color: warmColors.ink }}
              >
                Quantity (max 5):
              </label>
              <select
                id="product-quantity"
                data-testid="shop-quantity-select"
                value={quantity}
                onChange={e => setQuantity(Number(e.target.value))}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: `1px solid ${warmColors.border}`,
                  fontSize: '14px',
                  backgroundColor: warmColors.surface,
                  color: warmColors.ink,
                }}
              >
                {[1, 2, 3, 4, 5].map(q => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <Button
                variant="primary"
                onClick={handleAddToCart}
                testId="shop-add-to-cart-btn"
              >
                {added ? 'Added to Cart ✓' : 'Add to Cart'}
              </Button>
              {added && (
                <Button
                  variant="secondary"
                  onClick={() => navigate('/cart')}
                  testId="shop-view-cart-btn"
                >
                  View Cart →
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
