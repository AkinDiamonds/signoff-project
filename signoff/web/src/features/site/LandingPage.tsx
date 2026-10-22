/**
 * Public landing page for Signoff.
 * Communicates the problem, the signing-limit philosophy, how the system works,
 * public verified claims with ledger IDs, and a prominent 'Try it' call to action.
 */

import React from 'react';
import { Link } from 'react-router';
import { Banner, Card, ErrorState, Skeleton, colors, spacing } from '@signoff/ui';
import { useStatus } from '../../app/queries';
import { PUBLIC_CLAIMS } from './claims';

export const LandingPage: React.FC = () => {
  const status = useStatus();

  return (
    <div data-testid="landing-page" style={{ display: 'flex', flexDirection: 'column', gap: spacing[4] }}>
      {/* Hero Section */}
      <section
        aria-labelledby="hero-title"
        style={{
          backgroundColor: colors.surfaceSubtle,
          border: `1px solid ${colors.border}`,
          borderRadius: '12px',
          padding: `${spacing[4]} ${spacing[3]}`,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: spacing[2],
        }}
      >
        <span
          style={{
            display: 'inline-block',
            backgroundColor: colors.brandSurface,
            color: colors.brandPrimary,
            border: `1px solid ${colors.border}`,
            padding: '4px 12px',
            borderRadius: '16px',
            fontSize: '12px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Autonomous PayPal Dispute Operations
        </span>

        <h1
          id="hero-title"
          style={{
            fontSize: '32px',
            fontWeight: 800,
            color: colors.ink,
            margin: '0',
            lineHeight: 1.2,
            maxWidth: '720px',
          }}
        >
          AI-Driven Dispute Defense with Hard Signing Limits
        </h1>

        <p
          style={{
            fontSize: '16px',
            color: colors.inkMuted,
            maxWidth: '640px',
            margin: '0',
            lineHeight: 1.6,
          }}
        >
          Signoff resolves PayPal merchant disputes in minutes, synthesizes tracking evidence,
          and automatically enforces authority limits. The AI proposes plans; a deterministic gate enforces
          your rules; you approve exceptions on your phone.
        </p>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: spacing[2],
            justifyContent: 'center',
            marginTop: spacing[1],
          }}
        >
          <Link
            to="/guide"
            data-testid="landing-cta-guide"
            style={{
              backgroundColor: colors.brandPrimary,
              color: '#ffffff',
              padding: '12px 28px',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: 600,
              textDecoration: 'none',
              boxShadow: '0 2px 4px rgba(15, 118, 110, 0.2)',
            }}
          >
            Start 5-Minute Judge Tour →
          </Link>

          <Link
            to="/app"
            data-testid="landing-cta-dashboard"
            style={{
              backgroundColor: colors.surface,
              color: colors.ink,
              border: `1px solid ${colors.borderStrong}`,
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Open Merchant Dashboard
          </Link>
        </div>
      </section>

      {/* The Problem Section */}
      <section aria-labelledby="problem-title" style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
        <h2 id="problem-title" style={{ fontSize: '20px', fontWeight: 700, color: colors.ink, margin: 0 }}>
          The Problem: Unchecked LLMs vs. High-Stakes PayPal Deadlines
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: spacing[2],
          }}
        >
          <div
            style={{
              backgroundColor: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: '8px',
              padding: spacing[2],
            }}
          >
            <div style={{ fontSize: '18px', marginBottom: '4px' }} role="img" aria-label="Clock indicator">
              ⏱️
            </div>
            <strong style={{ color: colors.ink, display: 'block', marginBottom: '4px' }}>
              Strict 10-20 Day Deadlines
            </strong>
            <p style={{ margin: 0, fontSize: '13px', color: colors.inkMuted, lineHeight: 1.5 }}>
              Missed dispute deadlines result in automatic forfeiture of transaction funds and non-refundable fees.
              Manual dispute triage leaves merchants vulnerable to holiday surges and weekend delays.
            </p>
          </div>

          <div
            style={{
              backgroundColor: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: '8px',
              padding: spacing[2],
            }}
          >
            <div style={{ fontSize: '18px', marginBottom: '4px' }} role="img" aria-label="Shield alert indicator">
              ⚠️
            </div>
            <strong style={{ color: colors.ink, display: 'block', marginBottom: '4px' }}>
              The Hallucination Danger
            </strong>
            <p style={{ margin: 0, fontSize: '13px', color: colors.inkMuted, lineHeight: 1.5 }}>
              Giving an autonomous LLM direct write access to your PayPal wallet is reckless. A single hallucination
              or prompt injection can concede thousands of dollars in claims or accept fraudulent returns.
            </p>
          </div>

          <div
            style={{
              backgroundColor: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: '8px',
              padding: spacing[2],
            }}
          >
            <div style={{ fontSize: '18px', marginBottom: '4px' }} role="img" aria-label="Scales of justice indicator">
              ⚖️
            </div>
            <strong style={{ color: colors.ink, display: 'block', marginBottom: '4px' }}>
              All-or-Nothing Automation
            </strong>
            <p style={{ margin: 0, fontSize: '13px', color: colors.inkMuted, lineHeight: 1.5 }}>
              Merchants are forced to choose between slow, expensive manual reviews or black-box auto-responders
              with zero granular oversight or dollar limits.
            </p>
          </div>
        </div>
      </section>

      {/* The Signing Limit Idea */}
      <section
        aria-labelledby="signing-limit-title"
        style={{
          backgroundColor: '#f8fafc',
          border: `1px solid ${colors.border}`,
          borderRadius: '10px',
          padding: spacing[3],
        }}
      >
        <h2 id="signing-limit-title" style={{ fontSize: '20px', fontWeight: 700, color: colors.ink, marginTop: 0 }}>
          The Solution: The Authority Charter & Signing Limits
        </h2>
        <p style={{ fontSize: '14px', color: colors.inkMuted, lineHeight: 1.6 }}>
          Signoff introduces the concept of a merchant <strong>Authority Charter</strong>. Like corporate bank accounts
          with dual authorization, Signoff allows the AI to autonomously resolve routine disputes up to limits you set
          (e.g., auto-offer up to $25, auto-accept up to $15). Anything over your limit, involving repeat disputers, or
          prompt injection requires human signoff via a mobile-first authorization link.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: spacing[2],
            marginTop: spacing[2],
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              padding: spacing[2],
              borderRadius: '6px',
              border: `1px solid ${colors.border}`,
            }}
          >
            <span style={{ fontSize: '12px', fontWeight: 700, color: colors.brandPrimary, textTransform: 'uppercase' }}>
              Rule 1
            </span>
            <div style={{ fontWeight: 600, color: colors.ink, marginTop: '2px' }}>AI Proposes Only</div>
            <div style={{ fontSize: '12px', color: colors.inkMuted, marginTop: '4px' }}>
              The AI never communicates directly with PayPal. It outputs a structured resolution plan.
            </div>
          </div>

          <div
            style={{
              backgroundColor: '#ffffff',
              padding: spacing[2],
              borderRadius: '6px',
              border: `1px solid ${colors.border}`,
            }}
          >
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#b45309', textTransform: 'uppercase' }}>
              Rule 2
            </span>
            <div style={{ fontWeight: 600, color: colors.ink, marginTop: '2px' }}>Pure Deterministic Gate</div>
            <div style={{ fontSize: '12px', color: colors.inkMuted, marginTop: '4px' }}>
              Zero network I/O, no clock drift. Pure mathematical rule evaluation enforces your charter limits.
            </div>
          </div>

          <div
            style={{
              backgroundColor: '#ffffff',
              padding: spacing[2],
              borderRadius: '6px',
              border: `1px solid ${colors.border}`,
            }}
          >
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
              Rule 3
            </span>
            <div style={{ fontWeight: 600, color: colors.ink, marginTop: '2px' }}>1-Tap Mobile Signoff</div>
            <div style={{ fontSize: '12px', color: colors.inkMuted, marginTop: '4px' }}>
              Over-limit actions generate an encrypted token sent to your phone for instant review and signoff.
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Pipeline */}
      <section aria-labelledby="pipeline-title" style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
        <h2 id="pipeline-title" style={{ fontSize: '20px', fontWeight: 700, color: colors.ink, margin: 0 }}>
          How It Works: 5 Steps to Guaranteed Safety
        </h2>

        <ol
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: spacing[2],
            padding: 0,
            margin: 0,
            listStyle: 'none',
          }}
        >
          {[
            {
              step: '1',
              title: 'Webhook Sync',
              desc: 'PayPal dispute webhooks are verified via HMAC and synced transactionally.',
            },
            {
              step: '2',
              title: 'Evidence Assembly',
              desc: 'Tracking numbers, carrier delivery events, and order receipts are synthesized.',
            },
            {
              step: '3',
              title: 'Policy Gate',
              desc: 'Pure rules check currency, amounts, repeat disputers, and injection patterns.',
            },
            {
              step: '4',
              title: 'Merchant Signoff',
              desc: 'Charter exceptions route to the merchant phone with 1-tap approve/edit/deny.',
            },
            {
              step: '5',
              title: 'Write-Ahead Dispatch',
              desc: 'Confirmed actions are dispatched to PayPal with complete audit trail.',
            },
          ].map((item) => (
            <li
              key={item.step}
              style={{
                backgroundColor: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                padding: spacing[2],
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <span
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: colors.brandPrimary,
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {item.step}
              </span>
              <strong style={{ fontSize: '14px', color: colors.ink }}>{item.title}</strong>
              <span style={{ fontSize: '12px', color: colors.inkMuted, lineHeight: 1.4 }}>{item.desc}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Verified Claims Section */}
      <section aria-labelledby="claims-title" style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap' }}>
          <h2 id="claims-title" style={{ fontSize: '20px', fontWeight: 700, color: colors.ink, margin: 0 }}>
            Public Claims & Proof Ledger
          </h2>
          <span style={{ fontSize: '12px', color: colors.inkMuted }}>
            Strictly synced with <code>docs/claims-ledger.md</code>
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: spacing[2],
          }}
        >
          {PUBLIC_CLAIMS.slice(0, 6).map((claim) => (
            <article
              key={claim.id}
              data-testid={`claim-card-${claim.id}`}
              style={{
                backgroundColor: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                padding: spacing[2],
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '8px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <code style={{ fontSize: '11px', color: colors.brandPrimary, fontWeight: 700 }}>
                    {claim.id}
                  </code>
                  <span
                    style={{
                      fontSize: '10px',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      backgroundColor: claim.status === 'Verified' ? '#DCFCE7' : '#FEF3C7',
                      color: claim.status === 'Verified' ? '#166534' : '#92400E',
                      fontWeight: 600,
                    }}
                  >
                    {claim.status}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '13px', color: colors.ink, fontWeight: 500, lineHeight: 1.4 }}>
                  {claim.statement}
                </p>
              </div>
              <div style={{ fontSize: '11px', color: colors.inkMuted, borderTop: `1px solid ${colors.border}`, paddingTop: '6px' }}>
                Proof: <span style={{ fontFamily: 'monospace' }}>{claim.proof}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Call to Action Banner */}
      <section
        style={{
          backgroundColor: colors.brandSurface,
          border: `1px solid ${colors.border}`,
          borderRadius: '10px',
          padding: spacing[3],
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: spacing[2],
        }}
      >
        <h3 style={{ fontSize: '18px', fontWeight: 700, color: colors.ink, margin: 0 }}>
          Ready to experience the 5-minute evaluation?
        </h3>
        <p style={{ fontSize: '14px', color: colors.inkMuted, margin: 0, maxWidth: '500px' }}>
          Follow our interactive judge guide: buy a test product in the sandbox, report a dispute,
          and watch the policy gate enforce your authority charter.
        </p>
        <Link
          to="/guide"
          data-testid="landing-footer-cta"
          style={{
            backgroundColor: colors.brandPrimary,
            color: '#ffffff',
            padding: '10px 24px',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          View Judge Guide & Sandbox Instructions →
        </Link>
      </section>

      {/* System Status Card (Preserves existing contract for shell.test.tsx and shell.smoke.spec.ts) */}
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
            correlationId={status.error.correlationId}
            onRetry={() => void status.refetch()}
          />
        )}

        {status.isSuccess && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {status.data.demoFrozen && <Banner variant="frozen" />}
            {status.data.llmMode === 'CACHED' && <Banner variant="cached" />}
            <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '8px 16px', margin: 0 }}>
              <dt>Environment</dt>
              <dd style={{ margin: 0 }} data-testid="status-env">
                {status.data.env}
              </dd>
              <dt>PayPal</dt>
              <dd style={{ margin: 0 }} data-testid="status-paypal-env">
                {status.data.paypalEnv}
              </dd>
              <dt>LLM mode</dt>
              <dd style={{ margin: 0 }} data-testid="status-llm-mode">
                {status.data.llmMode}
              </dd>
            </dl>
          </div>
        )}
      </Card>
    </div>
  );
};
