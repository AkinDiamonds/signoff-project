import React, { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { components } from '@signoff/api-client/generated';
import { Button, ConceptCard, ConceptDisclosure, ConceptIcon, ConceptInfoBanner, ConceptPageTitle, ConceptPill, Money, concept, formatEventTime, toast } from '@signoff/ui';
import type { PillTone } from '@signoff/ui';
import { apiClient } from '../../app/api';
import { unwrap } from '../../app/queries';

type Shipment = components['schemas']['ShipmentView'];
type Action = components['schemas']['ShipmentAction']['action'];
const labels: Record<string, string> = {
  PRE_TRANSIT: 'Label created', IN_TRANSIT: 'In transit', OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered', EXCEPTION: 'Exception', RETURNED: 'Returned',
};
const stageLabel = (stage: string) => labels[stage] ?? stage.replaceAll('_', ' ');
const stageTone = (stage: string): PillTone => stage === 'DELIVERED' ? 'green' : stage === 'EXCEPTION' ? 'red' : stage === 'RETURNED' ? 'gray' : 'blue';
const detailsCss = '.concept-disclosure > summary::-webkit-details-marker, .shipment-card > summary::-webkit-details-marker { display:none } .shipment-card > summary { list-style:none } .shipment-card[open] > summary .chev { transform:rotate(180deg) }';

export const ShipmentsPage: React.FC = () => {
  const client = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const busyRef = useRef(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shipments = useQuery({
    queryKey: ['simulated-shipments'],
    queryFn: () => unwrap(apiClient.request<Shipment[]>('/api/fulfillment/orders')),
    refetchInterval: 15_000, retry: false,
  });
  const change = async (shipment: Shipment, action: Action) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(shipment.order_code); setMessage(null); setError(null);
    try {
      const result = await unwrap(apiClient.request<Shipment>('/api/fulfillment/orders/{order_code}/actions', {
        method: 'POST', params: { path: { order_code: shipment.order_code } },
        body: { base_version: shipment.version, request_id: crypto.randomUUID(), action },
      }));
      setMessage(`${result.order_code}: ${stageLabel(result.stage)}. Shipping is simulated.`);
      toast('Simulated shipment update saved.');
    } catch (failure) {
      toast('Shipment could not be changed. Refresh before retrying.', 'error');
      setError(failure instanceof Error ? failure.message : 'Shipment could not be changed. Refresh and try again.');
    } finally {
      await client.invalidateQueries({ queryKey: ['simulated-shipments'] });
      busyRef.current = false;
      setBusy(null);
    }
  };
  return (
    <div style={{ display: 'grid', gap: 20, maxWidth: 700, minWidth: 0 }}>
      <style>{detailsCss}</style>
      <ConceptPageTitle title="Shipments" />
      <ConceptInfoBanner icon="info" title="Sandbox shipments">Events are simulated, not carrier-confirmed.</ConceptInfoBanner>
      {message && <p role="status" style={{ color: '#065f46', margin: 0 }}>{message}</p>}
      {error && <p role="alert" style={{ color: concept.dangerText, margin: 0 }}>{error}</p>}
      {shipments.isPending && <p role="status">Loading simulated shipments…</p>}
      {shipments.isError && <div role="alert">
        <p>Couldn’t load shipments. Check your connection and try again.</p>
        <Button onClick={() => { void shipments.refetch(); }}>Try again</Button>
      </div>}
      {shipments.data?.length === 0 && <ConceptCard padding={24}>
        <h2 style={{ marginTop: 0 }}>No simulated shipments yet</h2>
        <p style={{ marginBottom: 0 }}>New verified sandbox payments start a shipment automatically. Existing orders keep their recorded history.</p>
      </ConceptCard>}
      {shipments.data?.map(shipment => {
        const pending = busy !== null;
        const terminal = shipment.stage === 'DELIVERED' || shipment.stage === 'RETURNED';
        const events = [...shipment.events].sort((a, b) => a.event_time.localeCompare(b.event_time));
        return <ConceptCard key={shipment.shipment_id} as="section" padding={0} aria-label={`Order ${shipment.order_code}`} style={{ minWidth: 0 }}>
          <details className="shipment-card">
            <summary style={{ cursor: 'pointer', minHeight: 64, padding: 18, display: 'grid', gap: 10 }}>
              <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <strong style={{ fontSize: 18, overflowWrap: 'anywhere' }}>{shipment.order_code}</strong>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Money money={shipment.amount} />
                  <span className="chev" style={{ display: 'flex' }}><ConceptIcon name="chevron-down" color={concept.muted} /></span>
                </span>
              </span>
              <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <ConceptPill tone={stageTone(shipment.stage)}>{stageLabel(shipment.stage)}</ConceptPill>
                <ConceptPill tone="gray">Simulated {shipment.carrier}</ConceptPill>
              </span>
            </summary>
            <div style={{ padding: '0 18px 18px', display: 'grid', gap: 14 }}>
              <ol aria-label="Simulated shipment history" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid' }}>
                {events.map((event, index) => <li key={`${event.event_time}-${index}`} style={{ display: 'grid', gridTemplateColumns: '12px 1fr', columnGap: 14, paddingBottom: index === events.length - 1 ? 0 : 18, position: 'relative' }}>
                  <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: '50%', background: concept.primary, marginTop: 7, zIndex: 1 }} />
                  {index < events.length - 1 && <span aria-hidden="true" style={{ position: 'absolute', left: 4, top: 17, bottom: 0, width: 2, background: concept.border }} />}
                  <span style={{ display: 'grid' }}>
                    <strong style={{ fontSize: 16 }}>{stageLabel(event.status)}</strong>
                    <time dateTime={event.event_time} style={{ fontSize: 14, color: concept.muted }}>{formatEventTime(event.event_time)}</time>
                  </span>
                </li>)}
              </ol>
              {shipment.mode === 'missing_tracking' && <p role="status" style={{ margin: 0 }}>Tracking is withheld for this scenario. The agent requires human review.</p>}
              {shipment.mode === 'exception' && <p role="status" style={{ margin: 0 }}>Simulated shipping exception. Automatic progress is paused for human review.</p>}
              {shipment.next_event_at && <p style={{ margin: 0, fontSize: 13, color: concept.muted }}>
                Next automatic milestone: <time dateTime={shipment.next_event_at}>{new Date(shipment.next_event_at).toLocaleString()}</time>
              </p>}
              <p style={{ margin: 0, fontSize: 13, overflowWrap: 'anywhere', color: concept.muted }}>
                Simulated {shipment.carrier} tracking: {shipment.tracking_number}
              </p>
              {!shipment.can_configure_scenario && <p style={{ margin: 0, paddingTop: 14, borderTop: `1px solid ${concept.border}`, display: 'flex', gap: 8, alignItems: 'center', color: concept.muted, fontSize: 14 }}>
                <ConceptIcon name="lock" size={18} />
                <span>Scenario locked: dispute exists<span style={{ display: 'block', fontSize: 13 }}>A PayPal dispute exists. Scenario settings are locked; normal shipment milestones can still advance.</span></span>
              </p>}
              <details>
                <summary style={{ minHeight: 44, cursor: 'pointer', fontWeight: 650, color: concept.primary, display: 'flex', alignItems: 'center' }}>Simulated shipment controls</summary>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', paddingTop: 8 }}>
                  <Button disabled={pending || terminal || shipment.mode !== 'normal'} onClick={() => { void change(shipment, 'advance'); }}>
                    {busy === shipment.order_code ? 'Updating…' : 'Advance simulated shipment'}
                  </Button>
                  {shipment.mode === 'normal' ? <>
                    <Button variant="secondary" disabled={pending || terminal || !shipment.can_configure_scenario}
                      onClick={() => { void change(shipment, 'exception'); }}>Simulate exception</Button>
                    <Button variant="secondary" disabled={pending || shipment.stage !== 'PRE_TRANSIT' || !shipment.can_configure_scenario}
                      onClick={() => { void change(shipment, 'missing_tracking'); }}>Withhold tracking</Button>
                  </> : <Button variant="secondary" disabled={pending || !shipment.can_configure_scenario}
                    onClick={() => { void change(shipment, 'resume'); }}>Resume simulated shipping</Button>}
                </div>
              </details>
            </div>
          </details>
        </ConceptCard>;
      })}
      <ConceptCard padding={0}>
        <ConceptDisclosure icon="info" title="How simulation works">
          <p style={{ margin: 0, lineHeight: 1.6 }}>
            Events advance automatically about once a minute. Use the controls on each shipment to move ahead or choose a sandbox scenario.
            Nothing is sent to a real carrier. Existing dispute decisions keep their original evidence; shipment changes do not submit a response.
          </p>
        </ConceptDisclosure>
      </ConceptCard>
    </div>
  );
};
