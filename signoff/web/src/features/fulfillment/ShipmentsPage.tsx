import React, { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { components } from '@signoff/api-client/generated';
import { Button, Money, PageHeader } from '@signoff/ui';
import { apiClient } from '../../app/api';
import { unwrap } from '../../app/queries';

type Shipment = components['schemas']['ShipmentView'];
type Action = components['schemas']['ShipmentAction']['action'];
const labels: Record<string, string> = {
  PRE_TRANSIT: 'Label created', IN_TRANSIT: 'In transit', OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered', EXCEPTION: 'Exception', RETURNED: 'Returned',
};
const stageLabel = (stage: string) => labels[stage] ?? stage.replaceAll('_', ' ');

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
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Shipment could not be changed. Refresh and try again.');
    } finally {
      await client.invalidateQueries({ queryKey: ['simulated-shipments'] });
      busyRef.current = false;
      setBusy(null);
    }
  };
  return (
    <div style={{ display: 'grid', gap: 20, maxWidth: 1000, minWidth: 0 }}>
      <PageHeader title="Shipments" description="Simulated shipping for your sandbox shop orders." />
      <section style={{ padding: 18, borderRadius: 12, background: '#ecfdf5', color: '#14532d', lineHeight: 1.6 }}>
        Events advance automatically about once a minute. Use the controls below to move ahead or choose a sandbox scenario.
        Nothing is sent to a real carrier. Existing dispute decisions keep their original evidence; shipment changes do not submit a response.
      </section>
      {message && <p role="status" style={{ color: '#065f46' }}>{message}</p>}
      {error && <p role="alert" style={{ color: '#9f1239' }}>{error}</p>}
      {shipments.isPending && <p role="status">Loading simulated shipments…</p>}
      {shipments.isError && <div role="alert">
        <p>Couldn’t load shipments. Check your connection and try again.</p>
        <Button onClick={() => { void shipments.refetch(); }}>Try again</Button>
      </div>}
      {shipments.data?.length === 0 && <section style={{ padding: 24, background: '#fff', borderRadius: 12 }}>
        <h2 style={{ marginTop: 0 }}>No simulated shipments yet</h2>
        <p>New verified sandbox payments start a shipment automatically. Existing orders keep their recorded history.</p>
      </section>}
      {shipments.data?.map(shipment => {
        const pending = busy !== null;
        const terminal = shipment.stage === 'DELIVERED' || shipment.stage === 'RETURNED';
        return <section key={shipment.shipment_id} aria-label={`Order ${shipment.order_code}`}
          style={{ padding: 'clamp(16px, 4vw, 24px)', border: '1px solid #dce5df', background: '#fff', borderRadius: 12, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: 20, overflowWrap: 'anywhere' }}>{shipment.order_code}</h2>
            <Money money={shipment.amount} />
          </div>
          <p style={{ color: '#0f766e', fontWeight: 650 }}>Simulated shipment · {stageLabel(shipment.stage)}</p>
          <p style={{ fontSize: 13, overflowWrap: 'anywhere', color: '#52605a' }}>
            Simulated {shipment.carrier} tracking: {shipment.tracking_number}
          </p>
          {shipment.mode === 'missing_tracking' && <p role="status">Tracking is withheld for this scenario. The agent requires human review.</p>}
          {shipment.mode === 'exception' && <p role="status">Simulated shipping exception. Automatic progress is paused for human review.</p>}
          {shipment.next_event_at && <p style={{ fontSize: 13, color: '#52605a' }}>
            Next automatic milestone: <time dateTime={shipment.next_event_at}>{new Date(shipment.next_event_at).toLocaleString()}</time>
          </p>}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
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
          {!shipment.can_configure_scenario && <p style={{ fontSize: 13, color: '#52605a' }}>
            A PayPal dispute exists. Scenario settings are locked; normal shipment milestones can still advance.
          </p>}
          <details style={{ marginTop: 18 }}>
            <summary style={{ cursor: 'pointer', minHeight: 32 }}>Simulated shipment history</summary>
            <ol style={{ paddingLeft: 20, lineHeight: 1.6 }}>
              {shipment.events.map((event, index) => <li key={`${event.event_time}-${index}`}>
                {stageLabel(event.status)} · {new Date(event.event_time).toLocaleString()} · {event.source}
              </li>)}
            </ol>
          </details>
        </section>;
      })}
    </div>
  );
};
