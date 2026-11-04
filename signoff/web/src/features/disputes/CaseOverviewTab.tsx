import React from 'react';
import { Link } from 'react-router';
import {
  ConceptButton, ConceptCard, ConceptDisclosure, ConceptIcon, ConceptInfoBanner, ConceptListGroup, ConceptPill,
  Deadline, Money, concept, type ConceptIconName, type PillTone,
} from '@signoff/ui';
import type { DisputeDetail } from './types';

export function paypalStatusPill(status: string): { tone: PillTone; label: string } {
  switch (status) {
    case 'WAITING_FOR_SELLER_RESPONSE': return { tone: 'amber', label: 'Waiting for your response' };
    case 'WAITING_FOR_BUYER_RESPONSE': return { tone: 'blue', label: 'Waiting for buyer' };
    case 'UNDER_REVIEW': return { tone: 'purple', label: 'Under review' };
    case 'RESOLVED': return { tone: 'green', label: 'Resolved' };
    default: return { tone: 'gray', label: status ? status.replaceAll('_', ' ').toLowerCase() : 'Unknown' };
  }
}

function decisionPill(verdict: string | null | undefined): { tone: PillTone; label: string } {
  if (verdict === 'ALLOW') return { tone: 'green', label: 'Allowed' };
  if (verdict === 'DENY') return { tone: 'red', label: 'Declined' };
  if (verdict === 'NEEDS_APPROVAL') return { tone: 'purple', label: 'Needs review' };
  return { tone: 'gray', label: 'Not recorded' };
}

function executionPill(state: string | null | undefined): { tone: PillTone; label: string } {
  switch (state) {
    case 'CONFIRMED': return { tone: 'green', label: 'Recorded' };
    case 'FAILED': return { tone: 'red', label: 'Failed' };
    case 'QUEUED': return { tone: 'amber', label: 'Queued' };
    case 'INTENDED': return { tone: 'amber', label: 'Sending' };
    case 'SENT': return { tone: 'amber', label: 'Sent, unconfirmed' };
    default: return { tone: 'gray', label: 'Not recorded' };
  }
}

const StatusRow: React.FC<{ icon: ConceptIconName; label: string; pill: { tone: PillTone; label: string }; testId?: string }> = ({ icon, label, pill, testId }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 56, padding: '10px 18px' }}>
    <ConceptIcon name={icon} />
    <strong style={{ flex: 1, fontSize: 17, fontWeight: 650 }}>{label}</strong>
    <ConceptPill tone={pill.tone} testId={testId}>{pill.label}</ConceptPill>
  </div>
);

const banner: React.CSSProperties = { display: 'block' };

export interface CaseOverviewProps {
  dispute: DisputeDetail;
  buyerMessage: string | null;
  expanded: boolean;
  onToggleExpanded: () => void;
  onInspect: () => void;
  onCopyLink: () => void;
  approvalSavedWithoutExecution: boolean;
  uncertainAction: boolean;
  reviewLabel: string;
  actionLabel: string;
  ruleId: string | null | undefined;
  ruleExplanation: string;
  currentApprovalUrl: string | null;
  needsDeliveryReview: boolean;
  needsPolicyReview: boolean;
  needsAnalysisReview: boolean;
  isAgentRunning: boolean;
}

export const CaseOverviewTab: React.FC<CaseOverviewProps> = (p) => {
  const { dispute } = p;
  const truncate = Boolean(p.buyerMessage && p.buyerMessage.length > 200);
  const shown = p.buyerMessage && truncate && !p.expanded ? `${p.buyerMessage.slice(0, 200)}...` : p.buyerMessage;
  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {p.uncertainAction && <div role="alert" style={{ border: '2px solid #b45309', borderRadius: 12, background: '#fff7ed', padding: 16, color: '#78350f' }}>
        Signoff cannot yet tell whether PayPal received this action. Sending it again could duplicate the response. Check the PayPal case and this history before taking another step.
      </div>}
      {p.approvalSavedWithoutExecution && <div role="status" style={banner}>
        <ConceptInfoBanner tone="warning" icon="alert-triangle" title="Approval saved">No execution recorded. Check PayPal before taking another step.</ConceptInfoBanner>
      </div>}
      {p.needsDeliveryReview && <div role="status"><ConceptInfoBanner tone="warning" icon="truck" title="Delivery evidence needs your review">
        Delivery proof is missing or unsafe. No automatic action was taken.{' '}
        <Link to="/app/shipments" style={{ color: concept.primary, fontWeight: 600 }}>Go to shipments</Link>
      </ConceptInfoBanner></div>}
      {p.needsPolicyReview && <div role="status"><ConceptInfoBanner tone="warning" icon="sliders" title="Signing limits need your review">
        Your limits changed or are unavailable. No action was sent.
      </ConceptInfoBanner></div>}
      {p.needsAnalysisReview && <div role="status"><ConceptInfoBanner tone="warning" icon="alert-triangle" title="Analysis needs your review">
        The latest analysis could not produce a valid plan. No action was proposed by this run. Check the audit history for details.
      </ConceptInfoBanner></div>}
      {p.isAgentRunning && <div data-testid="agent-in-progress-banner"><ConceptInfoBanner icon="clock" title="Agent actively analyzing PayPal dispute">
        Gathering available order evidence and checking merchant signing limits.
      </ConceptInfoBanner></div>}

      {p.currentApprovalUrl && <ConceptCard as="section" style={{ background: concept.subtle, display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Your decision is needed</h2>
        <p style={{ margin: 0 }}>Review the proposed response before anything is sent to PayPal.</p>
        <ConceptButton as="a" fullWidth testId="open-approval-card-button" href={p.currentApprovalUrl}>Review reply</ConceptButton>
      </ConceptCard>}

      <section aria-label="Current dispute status" data-testid="dispute-status-summary">
        <ConceptListGroup>
          <StatusRow icon="disputes" label="PayPal" pill={paypalStatusPill(dispute.status)} testId="detail-status-badge" />
          <StatusRow icon="shield" label="Decision" pill={decisionPill(dispute.latest_verdict)} testId="detail-verdict-chip" />
          <StatusRow icon="layers" label="Execution" pill={executionPill(dispute.latest_execution_status)} />
        </ConceptListGroup>
      </section>

      <section data-testid="dispute-buyer-message-panel" style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 750 }}>Buyer statement</h2>
        {p.buyerMessage ? <>
          <div style={{ display: 'flex', gap: 14, background: concept.subtle, borderRadius: 12, padding: 16 }}>
            <ConceptIcon name="quote" size={28} color={concept.muted} />
            <div data-testid="buyer-message-content" style={{ fontSize: 17, fontStyle: 'italic', lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', minWidth: 0 }}>{shown}</div>
          </div>
          {truncate && <button type="button" data-testid="toggle-buyer-message-button" onClick={p.onToggleExpanded} style={{ justifySelf: 'start', background: 'none', border: 0, color: concept.primary, font: 'inherit', fontWeight: 650, cursor: 'pointer', padding: 0 }}>{p.expanded ? 'Show less' : 'Show more'}</button>}
        </> : <p style={{ margin: 0, color: concept.muted }}>No textual statement submitted with this PayPal dispute.</p>}
        <span data-testid="untrusted-text-label" style={{ fontSize: 12, color: concept.muted }}>Buyer statement via PayPal</span>
        <ConceptButton variant="text" onClick={p.onInspect} style={{ justifySelf: 'start', padding: 0 }}>Inspect details →</ConceptButton>
      </section>

      <ConceptCard as="section" testId="dispute-decision-card" padding={0}>
        <ConceptDisclosure icon="shield" title="Your reply" subtitle="Review decision and signing rule">
          <div style={{ display: 'grid', gap: 8, fontSize: 15 }}>
            <div><span style={{ color: concept.muted }}>Review: </span>{p.reviewLabel}</div>
            <div><span style={{ color: concept.muted }}>Action: </span>{p.actionLabel}</div>
            <div title={p.ruleExplanation}><span style={{ color: concept.muted }}>Signing rule: </span><code>{p.ruleId ?? 'Not recorded'}</code></div>
            <div style={{ color: concept.muted }}>{p.ruleExplanation}.</div>
            {dispute.latest_verdict === 'NEEDS_APPROVAL' && !dispute.approval_url && (
              <p role="status" style={{ margin: 0 }}>No current approval card is available. It may have expired, been resolved, or become stale.</p>
            )}
          </div>
        </ConceptDisclosure>
      </ConceptCard>

      <ConceptCard as="section" testId="dispute-summary-card" padding={0}>
        <ConceptDisclosure icon="file" title="Case details" subtitle="Amount, due date and IDs">
          <dl style={{ margin: 0, display: 'grid', gap: 12, fontSize: 15 }}>
            <div><dt style={{ color: concept.muted }}>Disputed amount</dt><dd style={{ margin: 0, fontWeight: 700 }}><Money money={dispute.amount} testId="detail-amount" /></dd></div>
            <div><dt style={{ color: concept.muted }}>Store order reference</dt><dd style={{ margin: 0, fontWeight: 600 }}>{dispute.order_code ?? 'Not available'}</dd></div>
            <div><dt style={{ color: concept.muted }}>PayPal response due</dt><dd style={{ margin: 0 }}><Deadline dueAt={dispute.seller_response_due_date ?? null} /></dd></div>
            <div><dt style={{ color: concept.muted }}>PayPal dispute ID</dt><dd data-testid="dispute-detail-id" style={{ margin: 0, overflowWrap: 'anywhere' }}>Dispute ID: {dispute.id}</dd></div>
          </dl>
          <ConceptButton variant="secondary" onClick={p.onCopyLink} style={{ marginTop: 12 }}>Copy dispute link</ConceptButton>
        </ConceptDisclosure>
      </ConceptCard>
    </div>
  );
};
