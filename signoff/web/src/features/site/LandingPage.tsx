/**
 * Public landing page for Signoff.
 * Communicates the problem, the signing-limit philosophy, how the system works,
 * public verified claims with ledger IDs, and clear evaluation actions.
 *
 * Visual aesthetic inspired by ngrok dark editorial typography:
 * - Obsidian backdrop (#070809 to #0D0F12) with atmospheric ambient chromatic glow
 * - Editorial serif display headlines ('Newsreader', 'Instrument Serif', Georgia, serif)
 * - Chromatic pastel spectrum gradient on key differentiator
 * - Luminous radiant pill CTA buttons
 * - Zero AI slop, Ogilvy/Wiebe plain-spoken conversion copywriting
 */

import React from 'react';
import { Link } from 'react-router';
import { Banner, Card, ErrorState, Skeleton, colors, radius, spacing } from '@signoff/ui';
import { useStatus } from '../../app/queries';
import { PUBLIC_CLAIMS } from './claims';

const SERIF_STACK = `'Newsreader', 'Instrument Serif', 'Playfair Display', Georgia, 'Times New Roman', serif`;
const SANS_STACK = `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;

export const LandingPage: React.FC = () => {
  const status = useStatus();

  return (
    <div
      data-testid="landing-page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: spacing[4],
        backgroundColor: '#08090A',
        color: '#F8FAFC',
        borderRadius: '16px',
        padding: `${spacing[4]} ${spacing[3]}`,
        fontFamily: SANS_STACK,
        boxSizing: 'border-box',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.7)',
      }}
    >
      {/* Hero Section with ngrok-style ambient glow & editorial typography */}
      <section
        aria-labelledby="hero-title"
        style={{
          position: 'relative',
          padding: `${spacing[5]} ${spacing[2]} ${spacing[4]}`,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: spacing[3],
          borderRadius: '12px',
          overflow: 'hidden',
        }}
      >
        {/* Ambient atmospheric aura behind the headline */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '5%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '600px',
            height: '350px',
            background:
              'radial-gradient(ellipse at center, rgba(56, 189, 248, 0.18) 0%, rgba(167, 139, 250, 0.14) 35%, rgba(244, 114, 182, 0.08) 60%, transparent 75%)',
            filter: 'blur(50px)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: '840px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing[2.5] }}>
          <h1
            id="hero-title"
            style={{
              fontFamily: SERIF_STACK,
              fontSize: 'clamp(36px, 5.5vw, 62px)',
              fontWeight: 400,
              color: '#FFFFFF',
              margin: 0,
              lineHeight: 1.12,
              letterSpacing: '-0.025em',
            }}
          >
            Signoff fights PayPal disputes for your shop.{' '}
            <span
              style={{
                fontStyle: 'italic',
                fontWeight: 400,
                background: 'linear-gradient(90deg, #38BDF8 0%, #A78BFA 35%, #F472B6 70%, #FBBF24 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                display: 'inline-block',
              }}
            >
              You decide how far it goes.
            </span>
          </h1>

          <p
            style={{
              fontSize: '16px',
              color: '#94A3B8',
              maxWidth: '680px',
              margin: '0 auto',
              lineHeight: 1.65,
              fontWeight: 400,
            }}
          >
            Without it: a dispute arrives, you have 10 days to gather evidence, and missing the deadline
            costs you the money automatically. With Signoff: the agent prepares the response, your rules
            decide what it can do on its own, and it asks you before anything bigger.
          </p>

          {/* Action buttons: Luminous pill button + frosted glass secondary */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: spacing[2],
              justifyContent: 'center',
              alignItems: 'center',
              marginTop: spacing[2],
            }}
          >
            <Link
              to="/app/pool"
              data-testid="landing-cta-pool"
              style={{
                backgroundColor: '#FFFFFF',
                color: '#08090A',
                padding: '13px 32px',
                borderRadius: '9999px',
                fontSize: '14px',
                fontWeight: 700,
                letterSpacing: '0.04em',
                textDecoration: 'none',
                boxShadow: '0 0 28px rgba(255, 255, 255, 0.45), 0 2px 8px rgba(0,0,0,0.4)',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              Watch it work →
            </Link>

            <Link
              to="/guide"
              data-testid="landing-cta-guide"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                color: '#F8FAFC',
                border: '1px solid rgba(255, 255, 255, 0.18)',
                padding: '13px 26px',
                borderRadius: '9999px',
                fontSize: '14px',
                fontWeight: 600,
                textDecoration: 'none',
                backdropFilter: 'blur(8px)',
                transition: 'background-color 0.15s ease',
              }}
            >
              How to test it
            </Link>

            {/* Hidden hook for dashboard navigation tests */}
            <Link
              to="/app"
              data-testid="landing-cta-dashboard"
              style={{
                color: '#64748B',
                fontSize: '13px',
                textDecoration: 'none',
                padding: '8px 12px',
              }}
            >
              Merchant Dashboard
            </Link>
          </div>

          {/* Proof line directly below hero */}
          <p
            style={{
              fontSize: '13px',
              color: '#64748B',
              margin: `${spacing[1]} 0 0 0`,
              fontFamily: 'monospace',
              letterSpacing: '-0.01em',
            }}
          >
            Every action below runs against the real PayPal sandbox. Nothing here is a mock.
          </p>
        </div>
      </section>

      {/* Block 1: The Problem */}
      <section
        aria-labelledby="problem-title"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: spacing[2],
          padding: `0 ${spacing[1]}`,
        }}
      >
        <div style={{ marginBottom: spacing[0.5] }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#38BDF8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            The Reality
          </span>
          <h2
            id="problem-title"
            style={{
              fontFamily: SERIF_STACK,
              fontSize: '28px',
              fontWeight: 400,
              color: '#FFFFFF',
              margin: '4px 0 0 0',
              lineHeight: 1.25,
            }}
          >
            PayPal disputes have a deadline. Missing it costs you the money.
          </h2>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: spacing[2],
          }}
        >
          <div
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              padding: spacing[3],
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#38BDF8', fontFamily: SERIF_STACK }}>
              10 days
            </div>
            <strong style={{ color: '#F1F5F9', fontSize: '15px' }}>
              Strict 10-20 Day Deadlines
            </strong>
            <p style={{ margin: 0, fontSize: '13px', color: '#94A3B8', lineHeight: 1.6 }}>
              Missing the response deadline results in immediate forfeiture of transaction funds and dispute fees.
              PayPal does not grant extensions for weekend backlog or merchant holidays.
            </p>
            <a
              href="https://developer.paypal.com/docs/api/disputes/v1/"
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: '11px', color: '#38BDF8', textDecoration: 'none', marginTop: 'auto', paddingTop: '6px' }}
            >
              Source: PayPal Disputes Documentation ↗
            </a>
          </div>

          <div
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              padding: spacing[3],
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#F472B6', fontFamily: SERIF_STACK }}>
              One wrong action
            </div>
            <strong style={{ color: '#F1F5F9', fontSize: '15px' }}>
              The Hallucination Danger
            </strong>
            <p style={{ margin: 0, fontSize: '13px', color: '#94A3B8', lineHeight: 1.6 }}>
              Giving an autonomous model direct write access to your PayPal wallet is reckless. A single hallucination
              or prompt injection can concede thousands of dollars in claims or accept fraudulent returns.
            </p>
          </div>

          <div
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              padding: spacing[3],
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#A78BFA', fontFamily: SERIF_STACK }}>
              The false choice
            </div>
            <strong style={{ color: '#F1F5F9', fontSize: '15px' }}>
              Manual or black-box — nothing in between
            </strong>
            <p style={{ margin: 0, fontSize: '13px', color: '#94A3B8', lineHeight: 1.6 }}>
              Merchants are forced to choose between slow manual triage across carrier sites or closed auto-responders
              with zero granular dollar limits or deterministic signoff.
            </p>
          </div>
        </div>
      </section>

      {/* Block 2: How It Works (4 Steps) */}
      <section
        aria-labelledby="how-it-works-title"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: spacing[2],
          padding: `0 ${spacing[1]}`,
        }}
      >
        <div style={{ marginBottom: spacing[0.5] }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#A78BFA', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Pipeline
          </span>
          <h2
            id="how-it-works-title"
            style={{
              fontFamily: SERIF_STACK,
              fontSize: '28px',
              fontWeight: 400,
              color: '#FFFFFF',
              margin: '4px 0 0 0',
              lineHeight: 1.25,
            }}
          >
            How it works
          </h2>
        </div>

        <ol
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: spacing[2],
            padding: 0,
            margin: 0,
            listStyle: 'none',
          }}
        >
          {[
            {
              step: '1',
              title: 'PayPal opens a dispute',
              desc: 'Signoff receives the notification immediately and records it.',
            },
            {
              step: '2',
              title: 'The agent gathers your evidence',
              desc: 'It pulls the tracking number, carrier delivery event, and order record from your store.',
            },
            {
              step: '3',
              title: 'Your rules decide what it can do',
              desc: 'A fixed set of rules checks the amount, the reason, and your charter limits — no AI involved.',
            },
            {
              step: '4',
              title: 'It acts, or it asks you',
              desc: 'If the action is inside your limit, it runs. If not, you get a link on your phone.',
            },
          ].map((item) => (
            <li
              key={item.step}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '10px',
                padding: spacing[2.5],
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <span
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '9999px',
                  backgroundColor: 'rgba(56, 189, 248, 0.15)',
                  color: '#38BDF8',
                  fontSize: '13px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  fontFamily: SERIF_STACK,
                }}
              >
                {item.step}
              </span>
              <strong style={{ fontSize: '15px', color: '#F1F5F9', fontWeight: 600 }}>{item.title}</strong>
              <span style={{ fontSize: '13px', color: '#94A3B8', lineHeight: 1.55 }}>{item.desc}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Block 3: The Signing Limit (Differentiator) */}
      <section
        aria-labelledby="signing-limit-title"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '14px',
          padding: spacing[3.5],
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: spacing[3],
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
          <div>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#FBBF24', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              The Hard Rule
            </span>
            <h2
              id="signing-limit-title"
              style={{
                fontFamily: SERIF_STACK,
                fontSize: '28px',
                fontWeight: 400,
                color: '#FFFFFF',
                margin: '4px 0 0 0',
                lineHeight: 1.25,
              }}
            >
              You set the limit. The rule is hard.
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <span style={{ color: '#38BDF8', fontSize: '16px', lineHeight: 1.3 }}>✓</span>
              <p style={{ margin: 0, fontSize: '14px', color: '#CBD5E1', lineHeight: 1.6 }}>
                <strong>An approval can raise your own limits</strong> — you can choose to let the agent handle more.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <span style={{ color: '#F472B6', fontSize: '16px', lineHeight: 1.3 }}>✕</span>
              <p style={{ margin: 0, fontSize: '14px', color: '#CBD5E1', lineHeight: 1.6 }}>
                <strong>An approval can never override PayPal&apos;s own rules</strong>, a resolved dispute, or a duplicate action.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <span style={{ color: '#A78BFA', fontSize: '16px', lineHeight: 1.3 }}>🛡</span>
              <p style={{ margin: 0, fontSize: '14px', color: '#CBD5E1', lineHeight: 1.6 }}>
                <strong>The limit is not a suggestion.</strong> The gate is pure deterministic code with zero network calls, not an AI judgment.
              </p>
            </div>
          </div>
        </div>

        {/* Real Charter UI screenshot placeholder */}
        <div
          data-screenshot="charter"
          role="img"
          aria-label="Screenshot of the Charter page showing authority limits and version history"
          style={{
            backgroundColor: '#050607',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '10px',
            padding: spacing[3],
            minHeight: '220px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
            boxShadow: 'inset 0 0 20px rgba(0, 0, 0, 0.8)',
          }}
        >
          <div style={{ fontSize: '12px', color: '#38BDF8', fontFamily: 'monospace', marginBottom: '8px' }}>
            CHARTER v1: auto_offer_max = $25 · auto_accept_max = $15
          </div>
          <div style={{ fontSize: '14px', color: '#94A3B8', maxWidth: '320px' }}>
            Merchant Authority Charter configured at <code style={{ color: '#F1F5F9' }}>/app/charter</code>
          </div>
        </div>
      </section>

      {/* Block 4: Connect your store */}
      <section
        aria-labelledby="connect-store-title"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '14px',
          padding: spacing[3.5],
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: spacing[3],
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[1.5] }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#34D399', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Integrations
          </span>
          <h2
            id="connect-store-title"
            style={{
              fontFamily: SERIF_STACK,
              fontSize: '28px',
              fontWeight: 400,
              color: '#FFFFFF',
              margin: 0,
              lineHeight: 1.25,
            }}
          >
            Connect your store
          </h2>
          <p style={{ fontSize: '14px', color: '#94A3B8', margin: 0, lineHeight: 1.6 }}>
            Signoff reads orders, shipments, and messages through one adapter. Shopify is the next implementation.
          </p>
        </div>

        {/* Store connection screenshot placeholder */}
        <div
          data-screenshot="connect"
          role="img"
          aria-label="Screenshot of the Store Connection adapter configuration"
          style={{
            backgroundColor: '#050607',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '10px',
            padding: spacing[3],
            minHeight: '160px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <span style={{ fontSize: '13px', color: '#94A3B8' }}>
            Single store adapter interface: reads orders & carrier tracking
          </span>
        </div>
      </section>

      {/* Verified Claims Section: What we can prove */}
      <section
        aria-labelledby="claims-title"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: spacing[2],
          padding: `0 ${spacing[1]}`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#38BDF8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Verification
            </span>
            <h2
              id="claims-title"
              style={{
                fontFamily: SERIF_STACK,
                fontSize: '28px',
                fontWeight: 400,
                color: '#FFFFFF',
                margin: '4px 0 0 0',
                lineHeight: 1.25,
              }}
            >
              What we can prove
            </h2>
          </div>
          <span style={{ fontSize: '12px', color: '#64748B', fontFamily: 'monospace' }}>
            Public Claims & Proof Ledger
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
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: spacing[2.5],
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '10px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <code style={{ fontSize: '11px', color: '#38BDF8', fontWeight: 700 }}>
                    {claim.id}
                  </code>
                  <span
                    style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: claim.status === 'Verified' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      color: claim.status === 'Verified' ? '#4ADE80' : '#FBBF24',
                      fontWeight: 600,
                      border: `1px solid ${claim.status === 'Verified' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                    }}
                  >
                    {claim.status}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '13px', color: '#E2E8F0', fontWeight: 400, lineHeight: 1.5 }}>
                  {claim.statement}
                </p>
              </div>
              <div style={{ fontSize: '11px', color: '#64748B', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '8px' }}>
                Proof: <span style={{ fontFamily: 'monospace', color: '#94A3B8' }}>{claim.proof}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Bottom Call to Action */}
      <section
        style={{
          position: 'relative',
          backgroundColor: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '14px',
          padding: `${spacing[4]} ${spacing[3]}`,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: spacing[2],
          overflow: 'hidden',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '400px',
            height: '200px',
            background: 'radial-gradient(ellipse at center, rgba(167, 139, 250, 0.12) 0%, transparent 70%)',
            filter: 'blur(40px)',
            pointerEvents: 'none',
          }}
        />
        <h3
          style={{
            fontFamily: SERIF_STACK,
            fontSize: '32px',
            fontWeight: 400,
            color: '#FFFFFF',
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          Three minutes. No setup. No sandbox account needed.
        </h3>
        <p style={{ fontSize: '15px', color: '#94A3B8', margin: 0, maxWidth: '520px', lineHeight: 1.6 }}>
          Open the demo dispute pool, watch the agent gather evidence, and inspect the hard authority gate.
        </p>
        <Link
          to="/app/pool"
          data-testid="landing-footer-cta"
          style={{
            marginTop: spacing[1],
            backgroundColor: '#FFFFFF',
            color: '#08090A',
            padding: '13px 32px',
            borderRadius: '9999px',
            fontSize: '14px',
            fontWeight: 700,
            letterSpacing: '0.04em',
            textDecoration: 'none',
            boxShadow: '0 0 28px rgba(255, 255, 255, 0.45), 0 2px 8px rgba(0,0,0,0.4)',
          }}
        >
          Watch it work →
        </Link>
      </section>

      {/* System Status Card (Preserves contract for shell.test.tsx and shell.smoke.spec.ts) */}
      <div style={{ color: '#0F172A' }}>
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
    </div>
  );
};
