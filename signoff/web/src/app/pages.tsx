import React from 'react';
import { Link } from 'react-router';
import { Banner, Button, Card, EmptyState, ErrorState, Skeleton } from '@signoff/ui';
import type { ApiQueryError } from './queries';
import { useStatus } from './queries';

export const HomePage: React.FC = () => {
  const status = useStatus();

  return (
    <Card title="System status" testId="home-status-card">
      {status.isPending && (
        <div role="status" aria-label="Loading system status">
          <Skeleton height="20px" width="60%" />
          <Skeleton />
        </div>
      )}

      {status.isError && (
        <ErrorState
          testId="status-error"
          message={status.error.message}
          correlationId={(status.error as ApiQueryError).correlationId}
          onRetry={() => void status.refetch()}
        />
      )}

      {status.isSuccess && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {status.data.demoFrozen && <Banner variant="frozen" />}
          {status.data.llmMode === 'CACHED' && <Banner variant="cached" />}
          <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '8px 16px', margin: 0 }}>
            <dt>Environment</dt>
            <dd style={{ margin: 0 }} data-testid="status-env">{status.data.env}</dd>
            <dt>PayPal</dt>
            <dd style={{ margin: 0 }} data-testid="status-paypal-env">{status.data.paypalEnv}</dd>
            <dt>LLM mode</dt>
            <dd style={{ margin: 0 }} data-testid="status-llm-mode">{status.data.llmMode}</dd>
          </dl>
        </div>
      )}
    </Card>
  );
};

export const PlaceholderPage: React.FC<{ title: string; step: string }> = ({ title, step }) => (
  <EmptyState
    testId="placeholder-page"
    title={title}
    description={`This screen is built in step ${step}.`}
    action={<Link to="/">Back to home</Link>}
  />
);

export const NotFoundPage: React.FC = () => (
  <EmptyState
    testId="not-found-page"
    title="Page not found"
    description="The address you opened does not exist in Signoff."
    action={<Link to="/">Go to home</Link>}
  />
);
