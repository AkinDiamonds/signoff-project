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
        <h1 id="merchant-title" style={{ fontSize: '28px', margin: '0 0 8px 0' }}>
          Signoff Merchant Operations
        </h1>
        <p style={{ color: '#64748b', margin: 0 }}>
          Autonomous dispute management constrained by merchant charter rules.
        </p>
      </header>

      <Card title="System & Gateway Status" testId="merchant-status-card">
        {loading && (
          <div id="status-loading" style={{ padding: '16px', color: '#64748b' }}>
            Checking /api/status...
          </div>
        )}

        {error && (
          <div
            id="status-error"
            style={{
              padding: '16px',
              backgroundColor: '#fee2e2',
              color: '#991b1b',
              borderRadius: '6px',
              marginBottom: '16px',
            }}
          >
            <strong>Connection Error:</strong> {error}
            <div style={{ marginTop: '12px' }}>
              <Button variant="secondary" onClick={() => void fetchStatus()} testId="retry-btn">
                Retry Connection
              </Button>
            </div>
          </div>
        )}

        {data !== null && !loading && (
          <div id="status-success" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span>Gateway Health:</span>
              <StatusBadge verdict="ALLOW" testId="status-badge-ok" />
            </div>
            <pre
              id="status-payload"
              style={{
                backgroundColor: '#f1f5f9',
                padding: '12px',
                borderRadius: '6px',
                fontSize: '13px',
                overflowX: 'auto',
              }}
            >
              {JSON.stringify(data, null, 2)}
            </pre>
            <div>
              <Button variant="primary" onClick={() => void fetchStatus()} testId="refresh-btn">
                Refresh Status
              </Button>
            </div>
          </div>
        )}
      </Card>
    </main>
  );
};
