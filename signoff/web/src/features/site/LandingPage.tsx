/**
 * Public landing page for Signoff.
 * Modern B2B fintech aesthetic (Stripe / Linear inspired).
 * Plain-spoken, high-trust conversion copy, transparent signing limits,
 * live PayPal sandbox proof, and zero AI slop.
 */

import React from 'react';
import { Link } from 'react-router';
import { Banner, Card, ErrorState, Skeleton, colors, spacing, typography } from '@signoff/ui';
import { useStatus } from '../../app/queries';
import { PUBLIC_CLAIMS } from './claims';

export const LandingPage: React.FC = () => {
  const status = useStatus();

  return (
    <div
      data-testid="landing-page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: spacing[6],
        backgroundColor: '#0A0D12',
        color: '#F9FAFB',
        fontFamily: typography.fontFamily,
        boxSizing: 'border-box',
        maxWidth: '1200px',
        margin: '0 auto',
        padding: `${spacing[4]} ${spacing[3]} 64px`,
      }}
    >
      {/* Hero Section */}
      <section
        aria-labelledby="hero-title"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          padding: '48px 16px 32px',
          gap: spacing[3],
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(15, 118, 110, 0.15)',
            border: '1px solid rgba(20, 184, 166, 0.3)',
            color: '#2DD4BF',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10B981' }} />
          Verified PayPal Sandbox Integration
        </div>

        <h1
          id="hero-title"
          style={{
            fontSize: 'clamp(34px, 5vw, 56px)',
            fontWeight: 700,
            color: '#FFFFFF',
            margin: 0,
            lineHeight: 1.15,
            letterSpacing: '-0.03em',
            maxWidth: '880px',
          }}
        >
          Signoff fights PayPal disputes for your shop.{' '}
          <span style={{ color: '#2DD4BF', display: 'inline-block' }}>
            You decide how far it goes.
          </span>
        </h1>

        <p
          style={{
            fontSize: '18px',
            color: '#9CA3AF',
            maxWidth: '720px',
            margin: '0 auto',
            lineHeight: 1.6,
            fontWeight: 400,
          }}
        >
          Without it: a dispute arrives, you have 10 days to gather evidence, and missing the deadline
          costs you the money automatically. With Signoff: the agent prepares the response, your rules
          decide what it can do on its own, and it asks you before anything bigger.
        </p>

        {/* Action CTAs */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: '12px',
          }}
        >
          <Link
            to="/app"
            data-testid="landing-cta-dashboard"
            style={{
              backgroundColor: '#0F766E',
              color: '#FFFFFF',
              padding: '14px 28px',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: 600,
              textDecoration: 'none',
              transition: 'background-color 0.15s ease',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            Open Merchant Dashboard &rarr;
          </Link>

          <Link
            to="/app/pool"
            data-testid="landing-cta-pool"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              color: '#F3F4F6',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              padding: '14px 24px',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: 600,
              textDecoration: 'none',
              transition: 'background-color 0.15s ease',
            }}
          >
            Watch it work →
          </Link>

          <Link
            to="/guide"
            data-testid="landing-cta-guide"
            style={{
              color: '#9CA3AF',
              fontSize: '14px',
              textDecoration: 'none',
              padding: '14px 18px',
            }}
          >
            How to test it
          </Link>
        </div>

        <p
          style={{
            fontSize: '13px',
            color: '#6B7280',
            margin: '8px 0 0',
          }}
        >
          Every action below runs against the real PayPal sandbox. Nothing here is a mock.
        </p>
      </section>

      {/* Block 1: The Problem */}
      <section
        id="problem"
        aria-labelledby="problem-title"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: spacing[3],
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#2DD4BF', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            The Problem
          </span>
          <h2
            id="problem-title"
            style={{
              fontSize: '28px',
              fontWeight: 700,
              color: '#FFFFFF',
              margin: '6px 0 0',
              letterSpacing: '-0.02em',
            }}
          >
            PayPal disputes have a deadline. Missing it costs you the money.
          </h2>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: spacing[2],
          }}
        >
          <div
            style={{
              backgroundColor: '#111827',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              padding: spacing[3],
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ fontSize: '32px', fontWeight: 800, color: '#2DD4BF' }}>
              10 days
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#FFFFFF', margin: 0 }}>
              Strict Seller Deadline
            </h3>
            <p style={{ margin: 0, fontSize: '14px', color: '#9CA3AF', lineHeight: 1.5 }}>
              PayPal gives merchants exactly 10 days to respond. If you miss it, the buyer is awarded the full dispute automatically.
            </p>
          </div>

          <div
            style={{
              backgroundColor: '#111827',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              padding: spacing[3],
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#F87171' }}>
              The Hallucination Danger
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#FFFFFF', margin: 0 }}>
              Unbounded LLMs Concede Revenue
            </h3>
            <p style={{ margin: 0, fontSize: '14px', color: '#9CA3AF', lineHeight: 1.5 }}>
              Untrusted buyers can inject malicious instructions. Autonomous bots without hard limits risk granting unauthorized full refunds.
            </p>
          </div>
        </div>
      </section>

      {/* Block 2: Hard Signing Limits */}
      <section
        id="limits"
        aria-labelledby="signing-limit-title"
        style={{
          backgroundColor: '#111827',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: `${spacing[4]} ${spacing[3]}`,
          display: 'flex',
          flexDirection: 'column',
          gap: spacing[3],
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: '680px', margin: '0 auto' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#2DD4BF', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Merchant Charter
          </span>
          <h2
            id="signing-limit-title"
            style={{
              fontSize: '28px',
              fontWeight: 700,
              color: '#FFFFFF',
              margin: '6px 0 8px',
              letterSpacing: '-0.02em',
            }}
          >
            You set the limit. The rule is hard.
          </h2>
          <p style={{ margin: 0, fontSize: '15px', color: '#9CA3AF', lineHeight: 1.6 }}>
            The AI engine can draft defense packages, pull tracking receipts, and recommend actions. But a deterministic code gate prevents any money from moving unless your policy authorizes it.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: spacing[2],
          }}
        >
          <div style={{ padding: spacing[2], backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 6px', fontSize: '15px', color: '#FFFFFF', fontWeight: 600 }}>
              An approval can raise your own limits
            </h4>
            <p style={{ margin: 0, fontSize: '13px', color: '#9CA3AF', lineHeight: 1.5 }}>
              If an edge case exceeds your auto-refund threshold, Signoff generates an instant sign-off link for the store owner.
            </p>
          </div>

          <div style={{ padding: spacing[2], backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 6px', fontSize: '15px', color: '#FFFFFF', fontWeight: 600 }}>
              An approval can never override PayPal
            </h4>
            <p style={{ margin: 0, fontSize: '13px', color: '#9CA3AF', lineHeight: 1.5 }}>
              PayPal's dispute API is final. If a dispute phase has elapsed, our deterministic gate rejects invalid mutations before they ever reach the network.
            </p>
          </div>
        </div>
      </section>

      {/* Block 3: Pipeline (4 Steps) */}
      <section
        id="features"
        aria-labelledby="how-it-works-title"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: spacing[3],
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <h2
            id="how-it-works-title"
            style={{
              fontSize: '28px',
              fontWeight: 700,
              color: '#FFFFFF',
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            How it works
          </h2>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: spacing[2],
          }}
        >
          <div style={{ backgroundColor: '#111827', padding: spacing[3], borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#2DD4BF' }}>STEP 01</span>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#FFFFFF', margin: '6px 0 8px' }}>
              PayPal opens a dispute
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#9CA3AF', lineHeight: 1.5 }}>
              Signoff receives real-time dispute webhook events with the disputed amount and claim details.
            </p>
          </div>

          <div style={{ backgroundColor: '#111827', padding: spacing[3], borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#2DD4BF' }}>STEP 02</span>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#FFFFFF', margin: '6px 0 8px' }}>
              The agent gathers your evidence
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#9CA3AF', lineHeight: 1.5 }}>
              Order history, carrier tracking, and proof of delivery to the buyer's postal code are correlated automatically.
            </p>
          </div>

          <div style={{ backgroundColor: '#111827', padding: spacing[3], borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#2DD4BF' }}>STEP 03</span>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#FFFFFF', margin: '6px 0 8px' }}>
              Your rules decide what it can do
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#9CA3AF', lineHeight: 1.5 }}>
              The deterministic rule gate compares the proposed action and dollar amount against your merchant charter.
            </p>
          </div>

          <div style={{ backgroundColor: '#111827', padding: spacing[3], borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#2DD4BF' }}>STEP 04</span>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#FFFFFF', margin: '6px 0 8px' }}>
              It acts, or it asks you
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#9CA3AF', lineHeight: 1.5 }}>
              Under limit: submitted directly to PayPal before the deadline. Over limit: sends a one-tap magic link for your approval.
            </p>
          </div>
        </div>
      </section>

      {/* Block 4: Claims */}
      <section
        aria-labelledby="claims-title"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: spacing[3],
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <h2
            id="claims-title"
            style={{
              fontSize: '28px',
              fontWeight: 700,
              color: '#FFFFFF',
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            What we can prove
          </h2>
          <p style={{ fontSize: '14px', color: '#9CA3AF', margin: '6px 0 0' }}>
            Audited engineering assertions backed by cryptographic ledger records.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: spacing[2],
          }}
        >
          {PUBLIC_CLAIMS.slice(0, 6).map((claim) => (
            <article
              key={claim.id}
              data-testid={`claim-card-${claim.id}`}
              style={{
                backgroundColor: '#111827',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: spacing[2.5],
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '8px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <code style={{ fontSize: '11px', color: '#2DD4BF', fontWeight: 700 }}>
                    {claim.id}
                  </code>
                  <span
                    style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: claim.status === 'Verified' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                      color: claim.status === 'Verified' ? '#34D399' : '#FBBF24',
                      fontWeight: 600,
                    }}
                  >
                    {claim.status}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '13px', color: '#E5E7EB', lineHeight: 1.5 }}>
                  {claim.statement}
                </p>
              </div>
              <div style={{ fontSize: '11px', color: '#6B7280', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '6px' }}>
                Proof: <span style={{ fontFamily: 'monospace', color: '#9CA3AF' }}>{claim.proof}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* System Status Section (Test Contract Hook) */}
      <section style={{ marginTop: spacing[2] }}>
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
              <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '8px 16px', margin: 0, fontSize: '13px' }}>
                <dt style={{ color: colors.inkMuted }}>Environment</dt>
                <dd style={{ margin: 0, fontWeight: 600 }} data-testid="status-env">
                  {status.data.env}
                </dd>
                <dt style={{ color: colors.inkMuted }}>PayPal</dt>
                <dd style={{ margin: 0, fontWeight: 600 }} data-testid="status-paypal-env">
                  {status.data.paypalEnv}
                </dd>
                <dt style={{ color: colors.inkMuted }}>LLM mode</dt>
                <dd style={{ margin: 0, fontWeight: 600 }} data-testid="status-llm-mode">
                  {status.data.llmMode}
                </dd>
              </dl>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
};
