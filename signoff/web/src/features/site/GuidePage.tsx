/**
 * Judge Guide page at `/guide`.
 * Provides the 3-minute evaluation walkthrough, real-versus-simulated
 * architectural transparency, and direct links to live test scenarios.
 */

import React, { useState } from 'react';
import { colors, spacing } from '@signoff/ui';
import { ViewSwitcher } from './ViewSwitcher';

const SERIF_STACK = 'Inter, system-ui, sans-serif';

export const GuidePage: React.FC = () => {
  const [view, setView] = useState<'merchant' | 'buyer'>('merchant');
  return (
    <div data-testid="guide-page" style={{ display: 'flex', flexDirection: 'column', gap: spacing[3], color: colors.ink, maxWidth: 760, minWidth: 0 }}>
      <style>{`@media(max-width:700px) { .guide-matrix table, .guide-matrix tbody, .guide-matrix tr, .guide-matrix td { display:block; width:100%; } .guide-matrix thead { display:none; } .guide-matrix td { padding:6px 14px !important; overflow-wrap:anywhere; } .guide-matrix td:not(:first-child)::before { display:block; color:var(--signoff-muted, #686861); font-weight:600; } .guide-matrix td:nth-child(2)::before { content:"Real / live"; } .guide-matrix td:nth-child(3)::before { content:"Simulated / stubbed"; } .guide-matrix td:nth-child(4)::before { content:"Verification proof"; } .guide-matrix tr { padding:12px 0; } }`}</style>
      {/* Persistent Audience View Switcher */}
      <ViewSwitcher initialView="merchant" onViewChange={setView} />

      {/* Guide Header */}
      <header
        style={{
          borderBottom: `1px solid ${colors.border}`,
          paddingBottom: spacing[2],
        }}
      >
        <h1
          style={{
            fontFamily: SERIF_STACK,
            fontSize: '32px',
            fontWeight: 400,
            color: colors.ink,
            margin: '0 0 8px 0',
            lineHeight: 1.2,
          }}
        >
          Help
        </h1>
        <p style={{ fontSize: '15px', color: colors.inkMuted, margin: 0, lineHeight: 1.5 }}>
          Explore the sandbox with the appropriate merchant or buyer view. Merchant actions require a signed-in session.
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
          href="https://github.com/AkinDiamonds/signoff-project/blob/main/LICENSE"
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
        <span style={{ color: colors.inkMuted, fontSize: '13px' }}>Video walkthrough not available yet</span>
      </section>

      {view === 'merchant' ? <>
      {/* Numbered 5-Step Evaluation Path */}
      <section aria-labelledby="numbered-path-title" style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
        <h2 id="numbered-path-title" style={{ fontFamily: SERIF_STACK, fontSize: '22px', fontWeight: 400, color: colors.ink, margin: 0 }}>
          Follow these five steps
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
          {/* Step 1 */}
          <details data-testid="guide-step-1" style={{ borderBottom: `1px solid ${colors.border}`, padding: '12px 0' }}><summary style={{ minHeight: 44, cursor: 'pointer', fontWeight: 600 }}>Step 1: Open a live dispute</summary>
            <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: colors.ink, lineHeight: 1.5 }}>
              Open the demo dispute pool to see available cases. Availability depends on the current sandbox session.
            </p>
            <a
              href="/app/pool"
              data-testid="guide-step-1-link"
              style={{
                display: 'inline-block',
                backgroundColor: colors.brandPrimary,
                color: '#ffffff',
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Open Dispute Pool →
            </a>
          </details>

          {/* Step 2 */}
          <details data-testid="guide-step-2" style={{ borderBottom: `1px solid ${colors.border}`, padding: '12px 0' }}><summary style={{ minHeight: 44, cursor: 'pointer', fontWeight: 600 }}>Step 2: Watch it work</summary>
            <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: colors.ink, lineHeight: 1.5 }}>
              Observe the four timeline stages: evidence gathering from your store, evaluation against your rules,
              the policy gate verdict, and the recorded execution status. Timing varies, and a recorded confirmation
              does not independently verify the specific PayPal action.
            </p>
            <div style={{ fontSize: '12px', color: colors.inkMuted }}>
              The agent gathers available order and shipping evidence before evaluating the proposed action.
            </div>
          </details>

          {/* Step 3 */}
          <details data-testid="guide-step-3" style={{ borderBottom: `1px solid ${colors.border}`, padding: '12px 0' }}><summary style={{ minHeight: 44, cursor: 'pointer', fontWeight: 600 }}>Step 3: Approve something</summary>
            <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: colors.ink, lineHeight: 1.5 }}>
              If a current approval is available, inspect the proposed action and its consequences before deciding. A historical review state does not mean an approval is still available.
            </p>
            <a
              href="/app/disputes"
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
              View Disputes Needing Signoff →
            </a>
          </details>

          {/* Step 4 */}
          <details data-testid="guide-step-4" style={{ borderBottom: `1px solid ${colors.border}`, padding: '12px 0' }}><summary style={{ minHeight: 44, cursor: 'pointer', fontWeight: 600 }}>Step 4: See a prompt injection blocked</summary>
            <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: colors.ink, lineHeight: 1.5 }}>
              Look for a buyer message attempting prompt injection (e.g. demanding an unearned refund) and inspect
              the gate decision that deterministically blocks and fails closed.
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
                Inspect Injection Dispute →
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
                Scenario Controls →
              </a>
            </div>
          </details>

          {/* Step 5 */}
          <details data-testid="guide-step-5" style={{ borderBottom: `1px solid ${colors.border}`, padding: '12px 0' }}><summary style={{ minHeight: 44, cursor: 'pointer', fontWeight: 600 }}>Step 5: Ask the dashboard</summary>
            <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: colors.ink, lineHeight: 1.5 }}>
              Open Reports at <code>/app/reports</code> to inspect the four key operational metrics:
              dollars at risk, deadline radar, authority meter usage, and auto-resolved share.
            </p>
            <a
              href="/app/reports"
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
              Open Reports →
            </a>
          </details>
        </div>
      </section>

      </> : <section aria-label="Buyer guidance"><h2>Buyer sandbox</h2><p>Use the separate buyer shop to browse fictional products and review sandbox orders. A payment or dispute action changes the sandbox and requires an intentional step.</p><p>The buyer shop opens separately from merchant controls.</p></section>}

      {/* What is Real Table */}
      <section aria-labelledby="real-simulated-title" style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
        <h2 id="real-simulated-title" style={{ fontFamily: SERIF_STACK, fontSize: '22px', fontWeight: 400, color: colors.ink, margin: 0 }}>
          What is real
        </h2>

        <div className="guide-matrix" role="region" aria-label="Real and simulated features" tabIndex={0} style={{ overflowX: 'auto', border: `1px solid ${colors.border}`, borderRadius: '8px' }}>
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
                  real: 'Real PayPal sandbox (disputes, evidence submission, settlements)',
                  simulated: '—',
                  proof: 'agent/tests/test_paypal_stub.py',
                },
                {
                  component: 'Evidence (tracking, delivery)',
                  real: 'Available order information',
                  simulated: 'Demo shipment and tracking events',
                  proof: 'agent/tests/test_evidence.py',
                },
                {
                  component: 'Offers submitted',
                  real: 'Real PayPal sandbox dispute negotiation offers',
                  simulated: '—',
                  proof: 'agent/tests/test_paypal_stub.py',
                },
                {
                  component: 'Dispute Webhooks',
                  real: 'Real HMAC-SHA256 signature verification & deduplication',
                  simulated: '—',
                  proof: 'agent/tests/test_webhooks.py',
                },
                {
                  component: 'Orders and tracking',
                  real: '—',
                  simulated: 'Simulated store adapter',
                  proof: 'e2e/specs/shop.spec.ts',
                },
                {
                  component: 'LLM Reasoning',
                  real: 'Real model via server proxy with token & budget caps',
                  simulated: 'Deterministic scenario replay cache',
                  proof: 'agent/tests/test_llm.py',
                },
                {
                  component: 'Policy Gate Engine',
                  real: '100% pure deterministic Python rule engine (zero network/IO)',
                  simulated: '—',
                  proof: 'agent/tests/test_gate.py',
                },
                {
                  component: 'Mobile Approval Tokens',
                  real: 'Cryptographic SHA-256 single-use tokens',
                  simulated: '—',
                  proof: 'agent/tests/test_approvals.py',
                },
              ].map((row, idx) => (
                <tr
                  key={row.component}
                  style={{
                    borderBottom: idx < 7 ? `1px solid ${colors.border}` : 'none',
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
