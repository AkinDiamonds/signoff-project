import React from 'react';
import {
  ConceptButton, ConceptDisclosure, ConceptIcon, ConceptInfoBanner, ConceptListGroup, ConceptCard, ConceptPill,
  concept, formatEventTime, type ConceptIconName, type PillTone,
} from '@signoff/ui';
import type { EvidenceSnapshotResponse } from '../../app/queries';

const COMPONENTS: Record<string, { label: string; icon: ConceptIconName }> = {
  delivered: { label: 'Delivered', icon: 'truck' },
  tracking: { label: 'Tracking', icon: 'link' },
  buyer_history: { label: 'Buyer history', icon: 'user' },
  completeness: { label: 'Order details', icon: 'file' },
};

function componentLabel(name: string): { label: string; icon: ConceptIconName } {
  return COMPONENTS[name.toLowerCase().replaceAll(' ', '_')] ?? { label: name, icon: 'file' };
}

function strengthPill(strength: string | null | undefined, score: number | null | undefined): { tone: PillTone; label: string } {
  const word = strength ? strength[0] + strength.slice(1).toLowerCase() : 'Unavailable';
  const tone: PillTone = strength === 'HIGH' ? 'green' : strength === 'MEDIUM' ? 'amber' : strength === 'LOW' ? 'red' : 'gray';
  return { tone, label: score != null ? `${word} · ${score}/100` : word };
}

const captureLabel = (kind: string) => kind === 'pre_model_review' ? 'Review before model run' : kind === 'manual_refresh' ? 'Manual evidence refresh' : 'Model run';
const captureNote = (kind: string) => kind === 'pre_model_review' ? 'Review stopped before a model plan was created.'
  : kind === 'manual_refresh' ? 'Evidence refreshed without running the agent or submitting to PayPal.'
  : 'Gathered for this run. Check the audit trail for submission and PayPal confirmation.';

const SummaryRow: React.FC<{ icon: ConceptIconName; label: string; value: string }> = ({ icon, label, value }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 48, padding: '10px 18px' }}>
    <ConceptIcon name={icon} size={20} />
    <span style={{ flex: 1, fontSize: 16 }}>{label}</span>
    <span style={{ fontSize: 16, textAlign: 'right', overflowWrap: 'anywhere', minWidth: 0 }}>{value}</span>
  </div>
);

export interface CaseEvidenceProps {
  snapshots: EvidenceSnapshotResponse[] | undefined;
  loading: boolean;
  failed: boolean;
  strength: string | null;
  rawEvidence: Record<string, unknown> | null;
  refreshing: boolean;
  refreshMessage: string | null;
  onRefresh: () => void;
}

export const CaseEvidenceTab: React.FC<CaseEvidenceProps> = ({ snapshots, loading, failed, strength, rawEvidence, refreshing, refreshMessage, onRefresh }) => {
  const latest = snapshots?.[0];
  const ev = latest?.evidence;
  const pill = strengthPill(ev?.strength ?? strength, ev?.score);
  const simulated = Boolean(ev?.milestones.some(m => m.source === 'simulated')) || rawEvidence?.source === 'simulated';
  return (
    <section data-testid="dispute-evidence-panel" style={{ display: 'grid', gap: 20 }}>
      <div style={{ display: 'grid', gap: 8, justifyItems: 'start' }}>
        <ConceptPill tone={pill.tone} testId="evidence-strength-badge">{pill.label}</ConceptPill>
        {latest && <span style={{ fontSize: 15, color: concept.muted }}>Snapshot · {formatEventTime(latest.captured_at)}</span>}
      </div>

      {loading && <p role="status">Loading saved evidence…</p>}
      {failed && <p role="alert">Saved evidence could not be loaded. Try refreshing.</p>}
      {snapshots?.length === 0 && <p style={{ margin: 0 }}>No saved evidence snapshot is available for this dispute.</p>}
      {simulated && <ConceptInfoBanner icon="info" title="Simulated delivery">Not carrier-confirmed.</ConceptInfoBanner>}

      {ev && <>
        <ConceptListGroup>
          <SummaryRow icon="link" label="Order match" value={ev.order_code ?? 'Unavailable'} />
          {ev.amount ? <SummaryRow icon="file" label="Order total" value={`${ev.currency ?? ''} ${ev.amount}`.trim()} /> : <></>}
          {ev.items.length > 0 ? <SummaryRow icon="layers" label="Items" value={ev.items.join(', ')} /> : <></>}
        </ConceptListGroup>
        {ev.components.length > 0 && <ConceptListGroup label="Evidence score">
          {ev.components.map(component => {
            const { label, icon } = componentLabel(component.name);
            return <ConceptDisclosure key={component.name} icon={icon} title={<>{label}: {component.points}</>} subtitle={undefined}>
              <span style={{ color: concept.muted }}>{component.detail}</span>
            </ConceptDisclosure>;
          })}
        </ConceptListGroup>}
        {ev.buildable && ev.tracking_submission_count === 0 && <ConceptInfoBanner icon="file" title="Submission preview">Notes only. Does not submit to PayPal.</ConceptInfoBanner>}
        {ev.buildable && ev.tracking_submission_count !== 0 && <ConceptInfoBanner icon="file" title="Submission preview">{`Submission preview: ${ev.evidence_type}`}. Does not submit to PayPal.</ConceptInfoBanner>}
        {!ev.buildable && <p style={{ margin: 0, color: concept.muted }}>No evidence submission prepared.</p>}
      </>}

      <div style={{ display: 'grid', gap: 8, justifyItems: 'center' }}>
        <ConceptButton variant="secondary" fullWidth disabled={refreshing} onClick={onRefresh} style={{ borderColor: concept.primary, color: concept.primary }}>{refreshing ? 'Refreshing evidence…' : 'Refresh evidence'}</ConceptButton>
        <span style={{ fontSize: 14, color: concept.muted }}>Does not submit to PayPal.</span>
        {refreshMessage && <p role="status" style={{ margin: 0, textAlign: 'center' }}>{refreshMessage}</p>}
      </div>

      <ConceptCard padding={0}>
        <ConceptDisclosure testId="evidence-technical-details" icon="gear" title="Technical details">
          <div style={{ display: 'grid', gap: 16, fontSize: 14 }}>
            {snapshots?.map(snapshot => <div key={snapshot.run_id} style={{ display: 'grid', gap: 6 }}>
              <strong>{captureLabel(snapshot.capture_kind)} · {snapshot.run_id} · {new Date(snapshot.captured_at).toLocaleString()}</strong>
              <span>Order: {snapshot.evidence.order_code ?? 'Unavailable'} · Payment: {snapshot.evidence.payment_reference ?? 'Unavailable'}</span>
              {snapshot.evidence.amount && <span>Order total: {snapshot.evidence.currency} {snapshot.evidence.amount}</span>}
              {snapshot.evidence.items.length > 0 && <span>Items: {snapshot.evidence.items.join(', ')}</span>}
              <span>Evidence strength: {snapshot.evidence.strength ?? 'Unavailable'}{snapshot.evidence.score != null ? ` (${snapshot.evidence.score}/100)` : ''}</span>
              <ul style={{ margin: 0, paddingLeft: 20 }}>{snapshot.evidence.components.map(component => <li key={component.name}>{component.name}: {component.points} — {component.detail}</li>)}</ul>
              <span>{snapshot.evidence.explanation}</span>
              <span>{snapshot.evidence.buildable ? `Submission preview: ${snapshot.evidence.evidence_type}` : 'No evidence submission prepared.'}</span>
              {snapshot.evidence.notes && <span>{snapshot.evidence.notes}</span>}
              {snapshot.evidence.milestones.length > 0 && <ul style={{ margin: 0, paddingLeft: 20 }}>
                {snapshot.evidence.milestones.map((event, index) => <li key={`${event.event_time}-${index}`}>
                  {event.status} · {new Date(event.event_time).toLocaleString()} · {event.source === 'simulated' ? 'simulated · not carrier-confirmed' : event.source} · {event.carrier} {event.tracking_number}
                  {event.source_id && <> · Record {event.source_id}</>}
                </li>)}
              </ul>}
              <span>{captureNote(snapshot.capture_kind)}</span>
            </div>)}
            {rawEvidence ? <div>
              Recorded tracking: {rawEvidence.delivered_at ? new Date(String(rawEvidence.delivered_at)).toLocaleDateString() : 'Delivery date unavailable'}. Carrier: {String(rawEvidence.carrier ?? 'Unavailable')}; status: {String(rawEvidence.status ?? 'Unavailable')}. {rawEvidence.source === 'simulated' ? 'Simulated · not carrier-confirmed.' : 'Source not verified; carrier confirmation is unavailable.'}
            </div> : <div style={{ color: concept.muted }}>No external evidence package has been correlated for this dispute yet.</div>}
          </div>
        </ConceptDisclosure>
      </ConceptCard>
    </section>
  );
};
