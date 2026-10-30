import React, { Suspense, useState } from 'react';
import { Link } from 'react-router';
import { Button, Card, Skeleton, colors } from '@signoff/ui';
import type { StudioData } from './types';

const LazyStudio = React.lazy(async () => {
  const module = await import('./StudioCanvas');
  return { default: module.StudioCanvas };
});

const StudioFallback: React.FC = () => (
  <div role="alert" data-testid="studio-fallback" style={{ padding: '16px', color: colors.ink }}>
    <p>AG Studio could not load. The dispute list has the same data.</p>
    <Link to="/app/disputes" style={{ color: colors.brandPrimary, fontWeight: 600 }}>
      Open the plain dispute list
    </Link>
  </div>
);

class StudioErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override render(): React.ReactNode {
    if (this.state.failed) {
      return <StudioFallback />;
    }
    return this.props.children;
  }
}

export interface StudioEmbedProps {
  data: StudioData;
}

export const StudioEmbed: React.FC<StudioEmbedProps> = ({ data }) => {
  // Vitest jsdom doesn't support canvas layout; browser mounts AG Studio immediately
  const isJsdom = typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent);
  const [loaded, setLoaded] = useState(!isJsdom);

  if (!loaded) {
    return (
      <Card title="AG Studio workspace" testId="studio-prompt">
        <p style={{ marginTop: 0 }}>
          Build your own report from the live KPI and dispute data. The AG Studio watermark is
          expected without a licence key (ADR-015).
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px' }}>
          <Button testId="studio-load-button" onClick={() => setLoaded(true)}>
            Load AG Studio dashboard
          </Button>
          <Link to="/app/disputes" style={{ color: colors.brandPrimary }}>
            Or use the plain dispute list
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <section aria-label="AG Studio dashboard" data-testid="studio-region">
      <StudioErrorBoundary>
        <Suspense fallback={<Skeleton height="500px" />}>
          <LazyStudio data={data} />
        </Suspense>
      </StudioErrorBoundary>
    </section>
  );
};
