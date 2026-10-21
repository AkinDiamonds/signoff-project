/**
 * Catalog storefront home page.
 */

import React, { useState } from 'react';
import { Button, Card, ErrorState, Money, Skeleton } from '@signoff/ui';
import { useCart } from '../CartContext';
import { Link } from '../router';
import { warmColors, warmShadows } from '../theme';

export const HomePage: React.FC = () => {
  const { catalog, loadingCatalog, catalogError, refreshCatalog, addToCart } = useCart();
  const [addedSku, setAddedSku] = useState<string | null>(null);

  const products = Object.values(catalog);

  const handleQuickAdd = (sku: string) => {
    addToCart(sku, 1);
    setAddedSku(sku);
    setTimeout(() => setAddedSku(null), 2000);
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 16px' }}>
      {/* Hero section */}
      <section
        style={{
          marginBottom: '40px',
          textAlign: 'center',
          padding: '40px 20px',
          backgroundColor: warmColors.surface,
          borderRadius: '12px',
          border: `1px solid ${warmColors.border}`,
          boxShadow: warmShadows.sm,
        }}
      >
        <span
          style={{
            display: 'inline-block',
            padding: '4px 12px',
            borderRadius: '9999px',
            backgroundColor: warmColors.primaryLight,
            color: warmColors.primary,
            fontSize: '12px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '12px',
          }}
        >
          Artisan Soy Candles
        </span>
        <h1
          id="shop-title"
          style={{
            fontSize: '32px',
            fontWeight: 700,
            color: warmColors.ink,
            margin: '0 0 12px 0',
          }}
        >
          Luminary Candles
        </h1>
        <p
          style={{
            fontSize: '16px',
            color: warmColors.inkMuted,
            maxWidth: '600px',
            margin: '0 auto',
            lineHeight: 1.6,
          }}
        >
          Hand-poured artisan candles crafted with pure essential oils and sustainable soy wax.
          Explore our collection and test sandbox checkout below.
        </p>
      </section>

      {/* Catalog status / errors */}
      {loadingCatalog && products.length === 0 && (
        <div data-testid="shop-catalog-loading" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
          {[1, 2, 3, 4].map(idx => (
            <Card key={idx} testId={`shop-skeleton-${idx}`}>
              <div style={{ height: '160px', marginBottom: '16px' }}>
                <Skeleton width="100%" height="160px" />
              </div>
              <Skeleton width="60%" height="24px" />
              <div style={{ marginTop: '8px' }}>
                <Skeleton width="40%" height="18px" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {catalogError && (
        <ErrorState
          message={catalogError}
          onRetry={() => void refreshCatalog()}
          testId="shop-retry-catalog-btn"
        />
      )}

      {/* Product grid */}
      {products.length > 0 && (
        <div
          data-testid="shop-catalog-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '24px',
          }}
        >
          {products.map(product => {
            const isAdded = addedSku === product.sku;

            return (
              <div
                key={product.sku}
                data-testid={`shop-product-card-${product.sku}`}
                style={{
                  backgroundColor: warmColors.surface,
                  borderRadius: '12px',
                  border: `1px solid ${warmColors.border}`,
                  boxShadow: warmShadows.sm,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
              >
                {/* Candle graphic placeholder */}
                <div
                  style={{
                    height: '160px',
                    backgroundColor: warmColors.surfaceMuted,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderBottom: `1px solid ${warmColors.borderMuted}`,
                  }}
                >
                  <span style={{ fontSize: '48px', userSelect: 'none' }}>🕯️</span>
                  <span style={{ fontSize: '11px', color: warmColors.inkSubtle, marginTop: '4px' }}>
                    {product.sku}
                  </span>
                </div>

                <div
                  style={{
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    flex: 1,
                  }}
                >
                  <Link to={`/product/${product.sku}`}>
                    <h3
                      data-testid={`shop-product-title-${product.sku}`}
                      style={{
                        margin: '0 0 8px 0',
                        fontSize: '18px',
                        fontWeight: 600,
                        color: warmColors.ink,
                      }}
                    >
                      {product.name}
                    </h3>
                  </Link>

                  <p
                    style={{
                      margin: '0 0 16px 0',
                      fontSize: '13px',
                      color: warmColors.inkMuted,
                      lineHeight: 1.5,
                      flex: 1,
                    }}
                  >
                    {product.description}
                  </p>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: 'auto',
                      paddingTop: '16px',
                      borderTop: `1px solid ${warmColors.borderMuted}`,
                    }}
                  >
                    <div
                      style={{
                        fontSize: '18px',
                        fontWeight: 700,
                        color: warmColors.accent,
                      }}
                    >
                      <Money money={product.price} testId={`shop-product-price-${product.sku}`} />
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Link
                        to={`/product/${product.sku}`}
                        testId={`shop-view-product-${product.sku}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: `1px solid ${warmColors.border}`,
                          fontSize: '13px',
                          fontWeight: 500,
                          color: warmColors.ink,
                          backgroundColor: warmColors.surface,
                        }}
                      >
                        Details
                      </Link>
                      <Button
                        variant="primary"
                        onClick={() => handleQuickAdd(product.sku)}
                        testId={`shop-quick-add-${product.sku}`}
                      >
                        {isAdded ? 'Added ✓' : 'Add to cart'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
