/**
 * Catalog storefront home page.
 *
 * Implements Step 2, Rule 1-2:
 * - Page background #FFFFFF, 8px radius, no border on cards (subtle shadow only)
 * - Product grid: 3 columns at 1440px, 2 at 768px, 1 at 390px
 * - Card: square image area with warm neutral background and product initial in serif
 * - Name at 15px semibold, price at 13px secondary
 * - Whole card is the link to /product/:sku
 */

import React from 'react';
import { Card, ErrorState, Money, Skeleton } from '@signoff/ui';
import { useCart } from '../CartContext';
import { Link } from '../router';
import { colors, retailTheme } from '../theme';

export const HomePage: React.FC = () => {
  const { catalog, loadingCatalog, catalogError, refreshCatalog } = useCart();
  const products = Object.values(catalog);

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
        .product-grid {
          display: grid;
          gap: 24px;
          grid-template-columns: 1fr;
        }
        @media (min-width: 640px) {
          .product-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (min-width: 1024px) {
          .product-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }
        .product-card-link {
          text-decoration: none;
          color: inherit;
          display: flex;
          flex-direction: column;
          border-radius: 8px;
          background-color: #FFFFFF;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          overflow: hidden;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .product-card-link:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
        }
      `}</style>

      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Subtle Store Header */}
        <section
          style={{
            marginBottom: '32px',
            textAlign: 'center',
            padding: '24px 16px',
          }}
        >
          <h1
            id="shop-title"
            style={{
              fontSize: '28px',
              fontWeight: 700,
              color: retailTheme.ink,
              margin: '0 0 8px 0',
              fontFamily: retailTheme.serifFont,
              letterSpacing: '-0.02em',
            }}
          >
            Luminary Candles
          </h1>
          <p
            style={{
              fontSize: '14px',
              color: retailTheme.inkMuted,
              maxWidth: '520px',
              margin: '0 auto',
              lineHeight: 1.5,
            }}
          >
            Hand-poured artisan candles crafted with pure essential oils and natural soy wax.
          </p>
        </section>

        {/* Catalog loading skeletons */}
        {loadingCatalog && products.length === 0 && (
          <div
            data-testid="shop-catalog-loading"
            className="product-grid"
          >
            {[1, 2, 3].map(idx => (
              <Card key={idx} testId={`shop-skeleton-${idx}`}>
                <div style={{ aspectRatio: '1 / 1', marginBottom: '16px' }}>
                  <Skeleton width="100%" height="100%" />
                </div>
                <Skeleton width="60%" height="20px" />
                <div style={{ marginTop: '8px' }}>
                  <Skeleton width="40%" height="16px" />
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
            className="product-grid"
          >
            {products.map(product => {
              const initial = product.name ? product.name.charAt(0).toUpperCase() : 'C';

              return (
                <div
                  key={product.sku}
                  data-testid={`shop-product-card-${product.sku}`}
                >
                  <Link
                    to={`/product/${product.sku}`}
                    className="product-card-link"
                    testId={`shop-view-product-${product.sku}`}
                  >
                    {/* Square image area with solid warm background and product initial in serif */}
                    <div
                      style={{
                        width: '100%',
                        aspectRatio: '1 / 1',
                        backgroundColor: retailTheme.imageBg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        userSelect: 'none',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: retailTheme.serifFont,
                          fontSize: '56px',
                          color: colors.ink,
                          lineHeight: 1,
                        }}
                      >
                        {initial}
                      </span>
                    </div>

                    {/* Product Card Details */}
                    <div
                      style={{
                        padding: '16px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <div
                        data-testid={`shop-product-title-${product.sku}`}
                        style={{
                          fontSize: '15px',
                          fontWeight: 600,
                          color: retailTheme.ink,
                          lineHeight: 1.3,
                        }}
                      >
                        {product.name}
                      </div>

                      <div
                        style={{
                          fontSize: '13px',
                          color: retailTheme.inkMuted,
                          fontWeight: 500,
                        }}
                      >
                        <Money money={product.price} testId={`shop-product-price-${product.sku}`} />
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
