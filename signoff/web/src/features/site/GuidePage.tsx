/**
 * Help page at `/guide`: a five-step sandbox walkthrough plus real-versus-simulated transparency.
 */

import React, { useState } from 'react';
import { Link } from 'react-router';
import { ConceptButton, ConceptCard, ConceptDisclosure, ConceptIcon, ConceptListGroup, ConceptListRow, ConceptPageTitle, concept } from '@signoff/ui';
import { ViewSwitcher } from './ViewSwitcher';

const REPO_URL = 'https://github.com/AkinDiamonds/signoff-project';

const REAL_ROWS = [
  { component: 'PayPal Disputes API', real: 'Real PayPal sandbox (disputes, evidence submission, settlements)', simulated: '—', proof: 'agent/tests/test_paypal_stub.py' },
  { component: 'Evidence (tracking, delivery)', real: 'Available order information', simulated: 'Demo shipment and tracking events', proof: 'agent/tests/test_evidence.py' },
  { component: 'Offers submitted', real: 'Real PayPal sandbox dispute negotiation offers', simulated: '—', proof: 'agent/tests/test_paypal_stub.py' },
  { component: 'Dispute Webhooks', real: 'Real HMAC-SHA256 signature verification & deduplication', simulated: '—', proof: 'agent/tests/test_webhooks.py' },
  { component: 'Orders and tracking', real: '—', simulated: 'Simulated store adapter', proof: 'e2e/specs/shop.spec.ts' },
  { component: 'LLM Reasoning', real: 'Real model via server proxy with token & budget caps', simulated: 'Deterministic scenario replay cache', proof: 'agent/tests/test_llm.py' },
  { component: 'Policy Gate Engine', real: '100% pure deterministic Python rule engine (zero network/IO)', simulated: '—', proof: 'agent/tests/test_gate.py' },
  { component: 'Mobile Approval Tokens', real: 'Cryptographic SHA-256 single-use tokens', simulated: '—', proof: 'agent/tests/test_approvals.py' },
];

const css = `
.guide-acc > summary, .concept-disclosure > summary { list-style:none; }
.guide-acc > summary::-webkit-details-marker, .concept-disclosure > summary::-webkit-details-marker { display:none; }
.guide-acc[open] > summary .chev { transform:rotate(90deg); }
.guide-cell-label { display:none; }
@media(max-width:700px) {
  .guide-matrix table, .guide-matrix tbody, .guide-matrix tr, .guide-matrix td { display:block; width:100%; }
  .guide-matrix thead { display:none; }
  .guide-matrix td { padding:6px 14px !important; overflow-wrap:anywhere; }
  .guide-cell-label { display:block; color:${concept.muted}; font-weight:600; }
  .guide-matrix tr { padding:12px 0; }
}`;

const body: React.CSSProperties = { margin: '0 0 14px', fontSize: 16, lineHeight: 1.5, color: concept.ink };

interface StepProps {
  n: number;
  title: string;
  open?: boolean;
  children: React.ReactNode;
}

const Step: React.FC<StepProps> = ({ n, title, open, children }) => (
  <details className="guide-acc" data-testid={`guide-step-${n}`} open={open}>
    <summary style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 64, padding: '16px 18px', cursor: 'pointer' }}>
      <span aria-hidden="true" style={{ flex: 'none', width: 28, height: 28, borderRadius: '50%', background: concept.primarySoft, color: concept.primary, display: 'grid', placeItems: 'center', fontSize: 15, fontWeight: 700 }}>{n}</span>
      <span style={{ flex: 1, fontSize: 17, fontWeight: 650 }}>{title}</span>
      <span className="chev" style={{ display: 'flex' }}><ConceptIcon name="chevron-right" color={concept.muted} /></span>
    </summary>
    <div style={{ padding: '0 18px 18px 60px' }}>{children}</div>
  </details>
);

export const GuidePage: React.FC = () => {
  const [view, setView] = useState<'merchant' | 'buyer'>('merchant');
  const shop = import.meta.env.PUBLIC_SHOP_URL || 'http://localhost:5174';
  return (
    <div data-testid="guide-page" style={{ display: 'grid', gap: 24, color: concept.ink, maxWidth: 700, minWidth: 0 }}>
      <style>{css}</style>
      <ConceptPageTitle title="Help" subtitle="Test Signoff, step by step." />
      <ViewSwitcher initialView="merchant" onViewChange={setView} />

      {view === 'merchant' ? (
        <ConceptListGroup label="Five steps">
          <Step n={1} title="Open a dispute" open>
            <p style={body}>Choose an available sandbox case.</p>
            <ConceptButton as={Link} to="/app/pool" testId="guide-step-1-link">Open demo disputes →</ConceptButton>
          </Step>
          <Step n={2} title="Watch the agent">
            <p style={body}>
              Observe the four timeline stages: evidence gathering from your store, evaluation against your rules,
              the policy gate verdict, and the recorded execution status. Timing varies, and a recorded confirmation
              does not independently verify the specific PayPal action.
            </p>
            <p style={{ ...body, fontSize: 14, color: concept.muted, margin: 0 }}>
              The agent gathers available order and shipping evidence before evaluating the proposed action.
            </p>
          </Step>
          <Step n={3} title="Review a proposed action">
            <p style={body}>
              If a current approval is available, inspect the proposed action and its consequences before deciding. A historical review state does not mean an approval is still available.
            </p>
            <ConceptButton as={Link} to="/app/disputes" variant="secondary" testId="guide-step-3-link">View disputes →</ConceptButton>
          </Step>
          <Step n={4} title="Inspect blocked injection">
            <p style={body}>
              Look for a buyer message attempting prompt injection (e.g. demanding an unearned refund) and inspect
              the gate decision that deterministically blocks and fails closed.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <ConceptButton as={Link} to="/app/disputes" testId="guide-step-4-disputes-link">Inspect injection dispute →</ConceptButton>
              <ConceptButton as={Link} to="/app/demo" variant="secondary" testId="guide-step-4-demo-link">Scenario controls →</ConceptButton>
            </div>
          </Step>
          <Step n={5} title="Ask the dashboard">
            <p style={body}>
              Open Reports to inspect the key operational metrics: dollars at risk, deadline radar, and the read-only dashboard assistant.
            </p>
            <ConceptButton as={Link} to="/app/reports" variant="secondary" testId="guide-step-5-link">Open Reports →</ConceptButton>
          </Step>
        </ConceptListGroup>
      ) : (
        <ConceptCard as="section" aria-label="Buyer guidance" padding={0}>
          <div style={{ padding: 18, display: 'grid', gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 750 }}>Buyer sandbox</h2>
            <p style={{ ...body, margin: 0 }}>Use the separate buyer shop to browse fictional products and review sandbox orders. A payment or dispute action changes the sandbox and requires an intentional step.</p>
            <p style={{ ...body, margin: 0 }}>The buyer shop opens separately from merchant controls.</p>
          </div>
          <ConceptListGroup>
            <ConceptListRow as="a" href={`${shop}/`} target="_blank" rel="noreferrer" testId="view-link-buyer-shop" icon="store" title="Buyer shop" trailing="external" />
            <ConceptListRow as="a" href={`${shop}/cart`} target="_blank" rel="noreferrer" testId="view-link-buyer-cart" icon="link" title="Cart" trailing="external" />
            <ConceptListRow as="a" href={`${shop}/orders`} target="_blank" rel="noreferrer" testId="view-link-buyer-portal" icon="user" title="Buyer portal" trailing="external" />
          </ConceptListGroup>
        </ConceptCard>
      )}

      <ConceptListGroup label="Reference">
        <ConceptDisclosure title="Real vs simulated" testId="guide-real-vs-simulated">
          <div className="guide-matrix" role="region" aria-label="Real and simulated features" tabIndex={0} style={{ overflowX: 'auto', border: `1px solid ${concept.border}`, borderRadius: 12 }}>
            <table data-testid="real-simulated-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, textAlign: 'left' }}>
              <thead>
                <tr style={{ background: concept.subtle, borderBottom: `1px solid ${concept.border}` }}>
                  <th style={{ padding: '10px 14px' }}>System Component</th>
                  <th style={{ padding: '10px 14px' }}>Real / Live</th>
                  <th style={{ padding: '10px 14px' }}>Simulated / Stubbed</th>
                  <th style={{ padding: '10px 14px', color: concept.muted }}>Verification Proof</th>
                </tr>
              </thead>
              <tbody>
                {REAL_ROWS.map((row, idx) => (
                  <tr key={row.component} style={{ borderBottom: idx < REAL_ROWS.length - 1 ? `1px solid ${concept.border}` : 'none' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>{row.component}</td>
                    <td style={{ padding: '10px 14px' }}><span className="guide-cell-label">Real / live</span><span>{row.real}</span></td>
                    <td style={{ padding: '10px 14px' }}><span className="guide-cell-label">Simulated / stubbed</span><span>{row.simulated}</span></td>
                    <td style={{ padding: '10px 14px', color: concept.muted, fontFamily: 'monospace' }}><span className="guide-cell-label">Verification proof</span><span>{row.proof}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ margin: '14px 0 0', fontSize: 14, color: concept.muted }}>
            <a href={`${REPO_URL}/blob/main/LICENSE`} target="_blank" rel="noreferrer" data-testid="guide-link-license" style={{ color: concept.primary, fontWeight: 600 }}>MIT Open Source License ↗</a>
            {' · '}<span>Video walkthrough not available yet</span>
          </p>
        </ConceptDisclosure>
        <ConceptListRow as="a" href={REPO_URL} target="_blank" rel="noreferrer" testId="guide-link-repo" title="GitHub (sandbox and examples)" trailing="external" />
      </ConceptListGroup>
    </div>
  );
};
