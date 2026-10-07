import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createApiClient } from '@signoff/api-client';
import { Button, Card, StatusBadge } from '@signoff/ui';
import { getApiBaseUrl } from './config';

export const App: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  const client = useMemo(() => createApiClient({ baseUrl: getApiBaseUrl() }), []);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await client.getStatus();
      if (res.success && res.data) {
        setData(res.data);
      } else if (res.error) {
        const msg =
          res.error.kind === 'api_envelope' ? res.error.error.message : res.error.message;
        setError(`[${res.error.kind}] ${msg}`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  return (
    <main style={{ maxWidth: '800px', margin: '40px auto', padding: '0 20px' }}>
      <header style={{ marginBottom: '32px' }}>
        <h1 id="shop-title" style={{ fontSize: '28px', margin: '0 0 8px 0' }}>
          Luminary Candles
        </h1>
        <p style={{ color: '#78716c', margin: 0 }}>
          Hand-poured artisan soy candles & buyer customer portal.
        </p>
      </header>

      <Card title="Storefront Service Status" testId="shop-status-card">
        {loading && (
          <div id="shop-status-loading" style={{ padding: '16px', color: '#78716c' }}>
            Checking /api/status...
          </div>
        )}

        {error && (
          <div
            id="shop-status-error"
            style={{
              padding: '16px',
              backgroundColor: '#fee2e2',
              color: '#991b1b',
              borderRadius: '6px',
              marginBottom: '16px',
            }}
          >
            <strong>Storefront Offline:</strong> {error}
            <div style={{ marginTop: '12px' }}>
              <Button variant="secondary" onClick={() => void fetchStatus()} testId="shop-retry-btn">
                Retry Connection
              </Button>
            </div>
          </div>
        )}

        {data !== null && !loading && (
          <div id="shop-status-success" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span>Backend Availability:</span>
              <StatusBadge verdict="ALLOW" testId="shop-status-badge" />
            </div>
            <pre
              id="shop-status-payload"
              style={{
                backgroundColor: '#f5f5f4',
                padding: '12px',
                borderRadius: '6px',
                fontSize: '13px',
                overflowX: 'auto',
              }}
            >
              {JSON.stringify(data, null, 2)}
            </pre>
            <div>
              <Button variant="primary" onClick={() => void fetchStatus()} testId="shop-refresh-btn">
                Refresh Status
              </Button>
            </div>
          </div>
        )}
      </Card>
    </main>
  );
};
