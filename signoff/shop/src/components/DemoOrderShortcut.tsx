/**
 * Demo order shortcut component.
 *
 * Allows judges and evaluators to fast-track directly to an order confirmation
 * with a claimed, paid mock order tagged to the active session.
 */

import React, { useState } from 'react';
import { Button } from '@signoff/ui';
import { captureShopOrder, createShopOrder, getDemoSessionId, setDemoSessionId } from '../api';
import { useRouter } from '../router';
import { isStubCheckoutEnabled } from '../sandbox';
import { warmColors } from '../theme';

export interface DemoOrderShortcutProps {
  variant?: 'primary' | 'secondary';
  label?: string;
  testId?: string;
}

export const DemoOrderShortcut: React.FC<DemoOrderShortcutProps> = props => (
  isStubCheckoutEnabled() ? <LocalStubOrderShortcut {...props} /> : null
);

const LocalStubOrderShortcut: React.FC<DemoOrderShortcutProps> = ({
  variant = 'secondary',
  label = '⚡ Use a demo order',
  testId = 'shop-demo-order-shortcut-btn',
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { navigate } = useRouter();

  const handleClaimDemoOrder = async () => {
    setLoading(true);
    setError(null);
    try {
      let sessionId = getDemoSessionId();
      if (!sessionId) {
        // Generate a random demo session if none stored yet
        sessionId = `demo-${Math.random().toString(36).substring(2, 10)}`;
        setDemoSessionId(sessionId);
      }

      // 1. Create a paid mock order for Lavender Candle x 2
      const created = await createShopOrder({
        customer_email: 'alex.morgan@example.test',
        items: [{ sku: 'CND-LAV-01', quantity: 2 }],
        demo_session_id: sessionId,
      });

      // 2. Capture the order immediately
      await captureShopOrder(created.order_code, {
        paypal_order_id: created.paypal_order_id,
      });

      // 3. Navigate straight to confirmation
      navigate(`/confirmation/${created.order_code}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to claim demo order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '4px' }}>
      <Button
        variant={variant}
        onClick={() => void handleClaimDemoOrder()}
        disabled={loading}
        testId={testId}
      >
        {loading ? 'Claiming demo order...' : label}
      </Button>
      {error && (
        <span
          data-testid="shop-demo-order-error"
          style={{ fontSize: '12px', color: warmColors.errorInk }}
        >
          {error}
        </span>
      )}
    </div>
  );
};
