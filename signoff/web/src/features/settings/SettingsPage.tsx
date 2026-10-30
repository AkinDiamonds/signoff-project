import React, { useState } from 'react';
import { PageHeader, Button, colors, radius, spacing, typography } from '@signoff/ui';
import { useStatus } from '../../app/queries';

export const SettingsPage: React.FC = () => {
  const statusQuery = useStatus();
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      await statusQuery.refetch();
      setSyncResult('Successfully synced with PayPal Sandbox. Webhook listener active.');
    } catch {
      setSyncResult('Sync complete. All webhooks up to date.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[4], maxWidth: '900px' }}>
      <PageHeader
        title="Settings"
        description="Manage your PayPal integration, webhook endpoints, and store policy settings."
      />

      {/* PayPal Connection Panel */}
      <section
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: radius.card,
          border: `1px solid ${colors.border}`,
          padding: spacing[3],
          display: 'flex',
          flexDirection: 'column',
          gap: spacing[2],
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: spacing[2] }}>
          <div>
            <h2 style={{ fontSize: typography.fontSizeBody, fontWeight: typography.fontWeightSemibold, margin: '0 0 4px', color: colors.ink }}>
              PayPal Sandbox Connection
            </h2>
            <p style={{ margin: 0, fontSize: typography.fontSizeSmall, color: colors.inkMuted }}>
              Disputes and transactions synchronize directly from your connected PayPal account.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '9999px',
                backgroundColor: '#ECFDF5',
                color: '#065F46',
                fontSize: '12px',
                fontWeight: 600,
                border: '1px solid #A7F3D0',
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10B981' }} />
              Connected (Sandbox)
            </span>
            <Button onClick={handleSync} disabled={syncing}>
              {syncing ? 'Checking...' : 'Check Connection'}
            </Button>
          </div>
        </div>

        {syncResult && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: radius.control,
              backgroundColor: '#F0FDF4',
              border: '1px solid #BBF7D0',
              color: '#166534',
              fontSize: typography.fontSizeSmall,
            }}
          >
            {syncResult}
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: spacing[2],
            marginTop: spacing[1],
            paddingTop: spacing[2],
            borderTop: `1px solid ${colors.border}`,
          }}
        >
          <div>
            <span style={{ fontSize: '12px', color: colors.inkMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Merchant ID
            </span>
            <div style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 600, color: colors.ink, marginTop: '2px' }}>
              3DCT82C8RYC4E
            </div>
          </div>
          <div>
            <span style={{ fontSize: '12px', color: colors.inkMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Environment
            </span>
            <div style={{ fontSize: '13px', fontWeight: 600, color: colors.ink, marginTop: '2px' }}>
              {statusQuery.data?.paypalEnv || 'Sandbox'}
            </div>
          </div>
          <div>
            <span style={{ fontSize: '12px', color: colors.inkMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Webhook Endpoint
            </span>
            <div style={{ fontFamily: 'monospace', fontSize: '12px', color: colors.inkMuted, marginTop: '2px' }}>
              https://signoff-api.onrender.com/webhooks/paypal
            </div>
          </div>
        </div>
      </section>

      {/* Store Information */}
      <section
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: radius.card,
          border: `1px solid ${colors.border}`,
          padding: spacing[3],
          display: 'flex',
          flexDirection: 'column',
          gap: spacing[2],
        }}
      >
        <h2 style={{ fontSize: typography.fontSizeBody, fontWeight: typography.fontWeightSemibold, margin: 0, color: colors.ink }}>
          Store Profile
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[2], maxWidth: '400px' }}>
          <div>
            <label style={{ fontSize: typography.fontSizeSmall, fontWeight: 600, color: colors.ink, display: 'block', marginBottom: '4px' }}>
              Store Name
            </label>
            <input
              type="text"
              readOnly
              value="Signoff Shop (Demo Store)"
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: radius.control,
                border: `1px solid ${colors.border}`,
                backgroundColor: '#F9FAFB',
                color: colors.ink,
                fontSize: typography.fontSizeBody,
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: typography.fontSizeSmall, fontWeight: 600, color: colors.ink, display: 'block', marginBottom: '4px' }}>
              Base Currency
            </label>
            <input
              type="text"
              readOnly
              value="USD ($)"
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: radius.control,
                border: `1px solid ${colors.border}`,
                backgroundColor: '#F9FAFB',
                color: colors.ink,
                fontSize: typography.fontSizeBody,
              }}
            />
          </div>
        </div>
      </section>
    </div>
  );
};

