/**
 * Judge Guide page at `/guide`.
 * Provides the 5-minute evaluation path, test credentials,
 * real-versus-simulated architectural breakdown, links to repo/license/video,
 * and persistent view switcher.
 */

import React from 'react';
import { Card, colors, spacing } from '@signoff/ui';
import { ViewSwitcher } from './ViewSwitcher';

export const GuidePage: React.FC = () => {
  const shopBaseUrl = import.meta.env.PUBLIC_SHOP_URL || 'http://localhost:5174';

  return (
    <div data-testid="guide-page" style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] }}>
      {/* Persistent Audience View Switcher */}
      <ViewSwitcher initialView="merchant" />

      {/* Guide Header */}
      <header
        style={{
          borderBottom: `1px solid ${colors.border}`,
          paddingBottom: spacing[2],
        }}
      >
        <span
          style={{
            fontSize: '12px',
            fontWeight: 700,
            color: colors.brandPrimary,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Hackathon Evaluation Walkthrough
        </span>
        <h1 style={{ fontSize: '26px', fontWeight: 800, color: colors.ink, margin: '4px 0 8px 0' }}>
          5-Minute Judge Guide
        </h1>
        <p style={{ fontSize: '15px', color: colors.inkMuted, margin: 0, lineHeight: 1.5 }}>
          Follow this 5-step path to test both sides of Signoff: the buyer storefront experience and the merchant
          dispute defense operations.
        </p>
      </header>

      {/* Resource & Proof Links */}
      <section
        aria-label="Repository and evaluation resources"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: spacing[2],
          backgroundColor: colors.surfaceSubtle,
          border: `1px solid ${colors.border}`,
          borderRadius: '8px',
          padding: spacing[2],
        }}
      >
        <a
          href="https://github.com/AkinDiamonds/signoff-project"
          target="_blank"
          rel="noreferrer"
          data-testid="guide-link-repo"
          style={{
            color: colors.brandPrimary,
            fontSize: '13px',
            fontWeight: 600,
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          GitHub Repository ↗
        </a>
        <span style={{ color: colors.borderStrong }}>•</span>
        <a
          href="/LICENSE"
          target="_blank"
          rel="noreferrer"
          data-testid="guide-link-license"
          style={{
            color: colors.brandPrimary,
            fontSize: '13px',
            fontWeight: 600,
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          MIT Open Source License ↗
        </a>
        <span style={{ color: colors.borderStrong }}>•</span>
        <a
          href="https://www.youtube.com/watch?v=signoff-demo"
          target="_blank"
          rel="noreferrer"
          data-testid="guide-link-video"
          style={{
            color: colors.brandPrimary,
            fontSize: '13px',
            fontWeight: 600,
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          Video Walkthrough ↗
        </a>
      </section>

      {/* Numbered 5-Minute Path */}
      <section aria-labelledby="numbered-path-title" style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
        <h2 id="numbered-path-title" style={{ fontSize: '18px', fontWeight: 700, color: colors.ink, margin: 0 }}>
          Numbered Path: Test in 5 Minutes
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
          {/* Step 1 */}
          <Card title="Step 1: Open the Storefront" testId="guide-step-1">
            <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: colors.ink, lineHeight: 1.5 }}>
              Open our demonstration storefront (fictional artisan store). The shop is connected to the PayPal sandbox
              environment with custom catalog items and real-time cart pricing.
            </p>
            <a
              href={`${shopBaseUrl}/`}
              target="_blank"
              rel="noreferrer"
              data-testid="guide-step-1-link"
              style={{
                display: 'inline-block',
                backgroundColor: '#b45309',
                color: '#ffffff',
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Open Candle Storefront ↗
            </a>
          </Card>

          {/* Step 2 */}
          <Card title="Step 2: Use a Demo Order (or PayPal Checkout)" testId="guide-step-2">
            <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: colors.ink, lineHeight: 1.5 }}>
              In the shop cart, click <strong>&quot;Use a demo order&quot;</strong> to instantly claim a pre-funded paid
              sandbox order without typing credit card numbers. Alternatively, complete a live sandbox checkout using
              the PayPal buttons and the test credentials below.
            </p>
            <div style={{ fontSize: '12px', color: colors.inkMuted }}>
              Copy the resulting 10-character Order Code (e.g., <code>ORD-xxxxxx</code>) displayed on the confirmation page.
            </div>
          </Card>

          {/* Step 3 */}
          <Card title="Step 3: Report a Problem (Buyer Portal)" testId="guide-step-3">
            <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: colors.ink, lineHeight: 1.5 }}>
              Go to the Buyer Portal, enter your Order Code and buyer email (<code>alex.morgan@example.test</code>),
              and click <strong>&quot;Report a Problem&quot;</strong>. Select a supported reason:
              <em>&quot;Item Not Received&quot;</em> or <em>&quot;Significantly Not As Described&quot;</em>.
            </p>
            <a
              href={`${shopBaseUrl}/orders`}
              target="_blank"
              rel="noreferrer"
              data-testid="guide-step-3-link"
              style={{
                display: 'inline-block',
                backgroundColor: colors.surface,
                color: colors.ink,
                border: `1px solid ${colors.borderStrong}`,
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Go to Buyer Order Lookup ↗
            </a>
          </Card>

          {/* Step 4 */}
          <Card title="Step 4: Watch the Dashboard & Policy Gate" testId="guide-step-4">
            <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: colors.ink, lineHeight: 1.5 }}>
              Switch back to the Signoff Dashboard (`/app` or `/app/disputes`). The dispute is ingested instantly via
              verified webhooks. The AI assembles shipping evidence, evaluates the claim, and sends the proposed action
              to the pure deterministic policy gate.
            </p>
            <div style={{ display: 'flex', gap: spacing[1], flexWrap: 'wrap' }}>
              <a
                href="/app/disputes"
                data-testid="guide-step-4-disputes-link"
                style={{
                  backgroundColor: colors.brandPrimary,
                  color: '#ffffff',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                View Disputes List →
              </a>
              <a
                href="/app/demo"
                data-testid="guide-step-4-demo-link"
                style={{
                  backgroundColor: colors.surface,
                  color: colors.ink,
                  border: `1px solid ${colors.borderStrong}`,
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Trigger Demo Scenarios A-E →
              </a>
            </div>
          </Card>

          {/* Step 5 */}
          <Card title="Step 5: Approve on Mobile (1-Tap Signoff)" testId="guide-step-5">
            <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: colors.ink, lineHeight: 1.5 }}>
              For disputes that exceed charter thresholds (e.g. Scenario B, C, or E), Signoff generates a mobile-first
              cryptographic approval token. Open the approval screen (`/approve/:token`) on your mobile browser or
              viewport to review evidence, adjust settlement offers, and execute the signoff with a single tap.
            </p>
            <div style={{ fontSize: '12px', color: colors.inkMuted }}>
              Notice: Double-tap protection, anti-tampering amount validation, and instant write-ahead execution.
            </div>
          </Card>
        </div>
      </section>

      {/* Test Credentials Card */}
      <section aria-labelledby="credentials-title">
        <Card title="Sandbox Test Credentials" testId="guide-credentials-card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[1] }}>
            <p style={{ margin: 0, fontSize: '13px', color: colors.ink, lineHeight: 1.5 }}>
              All interactions run exclusively against the official PayPal Sandbox environment. No real money or personal
              credit accounts are ever accessed or charged.
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: spacing[2],
                marginTop: spacing[1],
              }}
            >
              <div
                style={{
                  backgroundColor: colors.surfaceSubtle,
                  border: `1px solid ${colors.border}`,
                  padding: spacing[2],
                  borderRadius: '6px',
                }}
              >
                <strong style={{ fontSize: '13px', color: colors.ink, display: 'block' }}>
                  Public Test Buyer
                </strong>
                <div style={{ fontSize: '12px', color: colors.inkMuted, marginTop: '4px' }}>
                  Email: <code data-testid="guide-buyer-email">alex.morgan@example.test</code>
                </div>
                <div style={{ fontSize: '11px', color: colors.inkMuted, marginTop: '2px' }}>
                  Use with any standard sandbox password or fast-track using &quot;Use a demo order&quot;.
                </div>
              </div>

              <div
                style={{
                  backgroundColor: colors.surfaceSubtle,
                  border: `1px solid ${colors.border}`,
                  padding: spacing[2],
                  borderRadius: '6px',
                }}
              >
                <strong style={{ fontSize: '13px', color: colors.ink, display: 'block' }}>
                  Merchant Sandbox Account
                </strong>
                <div style={{ fontSize: '12px', color: colors.inkMuted, marginTop: '4px' }}>
                  Merchant ID: <code data-testid="guide-merchant-id">sb-merchant@example.test</code>
                </div>
                <div style={{ fontSize: '11px', color: colors.inkMuted, marginTop: '2px' }}>
                  Pre-configured with Authority Charter v1 ($25 auto-offer, $15 auto-accept).
                </div>
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* Real-versus-Simulated Table */}
      <section aria-labelledby="real-simulated-title" style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
        <h2 id="real-simulated-title" style={{ fontSize: '18px', fontWeight: 700, color: colors.ink, margin: 0 }}>
          Real vs. Simulated Architecture
        </h2>

        <div style={{ overflowX: 'auto', border: `1px solid ${colors.border}`, borderRadius: '8px' }}>
          <table
            data-testid="real-simulated-table"
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '13px',
              textAlign: 'left',
              backgroundColor: colors.surface,
            }}
          >
            <thead>
              <tr style={{ backgroundColor: colors.surfaceSubtle, borderBottom: `2px solid ${colors.border}` }}>
                <th style={{ padding: '10px 14px', fontWeight: 700, color: colors.ink }}>System Component</th>
                <th style={{ padding: '10px 14px', fontWeight: 700, color: '#166534' }}>Real / Live</th>
                <th style={{ padding: '10px 14px', fontWeight: 700, color: '#92400E' }}>Simulated / Stubbed</th>
                <th style={{ padding: '10px 14px', fontWeight: 700, color: colors.inkMuted }}>Verification Proof</th>
              </tr>
            </thead>
            <tbody>
              {[
                {
                  component: 'PayPal Disputes API',
                  real: 'Full REST API integration in dev & production sandbox environments',
                  simulated: 'Deterministic offline stub with fault injection for tests',
                  proof: 'agent/tests/test_paypal_stub.py',
                },
                {
                  component: 'Dispute Webhooks',
                  real: 'Real HMAC-SHA256 signature verification & deduplication',
                  simulated: 'Synthetic webhook generator for automated scenarios A-E',
                  proof: 'agent/tests/test_webhooks.py',
                },
                {
                  component: 'Policy Gate Engine',
                  real: '100% pure deterministic Python rule engine (zero network/IO)',
                  simulated: 'None (gate is identical in all environments)',
                  proof: 'agent/tests/test_gate.py',
                },
                {
                  component: 'Storefront Checkout',
                  real: 'PayPal JavaScript SDK standard sandbox checkout flow',
                  simulated: 'Instant demo order claim shortcut for fast-track testing',
                  proof: 'e2e/specs/shop.spec.ts',
                },
                {
                  component: 'Shipping Carrier Evidence',
                  real: 'Formatted tracking numbers, carrier schemas, and delivery timestamps',
                  simulated: 'Artisan carrier mock records for scenario reproducibility',
                  proof: 'agent/tests/test_evidence.py',
                },
                {
                  component: 'LLM Reasoning',
                  real: 'OpenAI-compatible LLM provider interface with budget caps',
                  simulated: 'Deterministic cached plan replay for CI & local mode',
                  proof: 'agent/tests/test_llm.py',
                },
                {
                  component: 'Mobile Approval Tokens',
                  real: 'Real cryptographic SHA-256 tokens-at-rest with expiration',
                  simulated: 'None (full security protocol active in all environments)',
                  proof: 'agent/tests/test_approvals.py',
                },
              ].map((row, idx) => (
                <tr
                  key={row.component}
                  style={{
                    borderBottom: idx < 6 ? `1px solid ${colors.border}` : 'none',
                    backgroundColor: idx % 2 === 0 ? '#ffffff' : colors.surfaceSubtle,
                  }}
                >
                  <td style={{ padding: '10px 14px', fontWeight: 600, color: colors.ink }}>{row.component}</td>
                  <td style={{ padding: '10px 14px', color: '#166534' }}>{row.real}</td>
                  <td style={{ padding: '10px 14px', color: '#92400E' }}>{row.simulated}</td>
                  <td style={{ padding: '10px 14px', color: colors.inkMuted, fontFamily: 'monospace', fontSize: '11px' }}>
                    {row.proof}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
