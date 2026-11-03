import React, { useMemo } from 'react';
import { Link } from 'react-router';
import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef, type ICellRendererParams } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { Deadline, Money, StatusBadge, formatDisputeReason } from '@signoff/ui';
import type { DisputeListItem } from './types';

ModuleRegistry.registerModules([AllCommunityModule]);
const theme = themeQuartz.withParams({ accentColor: '#14532d', backgroundColor: '#ffffff', foregroundColor: '#17201b', borderColor: '#e1e7e3', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 16, rowHeight: 84, headerHeight: 52, spacing: 8 });
export const DisputesGrid: React.FC<{ rows: DisputeListItem[]; returnTo: string }> = ({ rows, returnTo }) => {
  const columns = useMemo<ColDef<DisputeListItem>[]>(() => [
    { headerName: 'Dispute', field: 'id', minWidth: 190, cellRenderer: (p: ICellRendererParams<DisputeListItem>) => p.data ? <Link to={`/app/disputes/${p.data.id}`} state={{ from: returnTo, scrollY: window.scrollY }} style={{ color: 'var(--signoff-action-primary)', fontWeight: 600 }}>{p.data.order_code || p.data.id}</Link> : null },
    { headerName: 'Buyer reason', field: 'reason', minWidth: 180, valueFormatter: p => formatDisputeReason(p.value) },
    { headerName: 'Amount', minWidth: 140, valueGetter: p => p.data?.amount.value, cellStyle: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' }, cellRenderer: (p: ICellRendererParams<DisputeListItem>) => p.data ? <Money money={p.data.amount} /> : null },
    { headerName: 'PayPal status', field: 'status', minWidth: 160, cellRenderer: (p: ICellRendererParams<DisputeListItem>) => p.data ? <StatusBadge status={p.data.status} /> : null },
    { headerName: 'Review decision', field: 'latest_verdict', minWidth: 170, cellRenderer: (p: ICellRendererParams<DisputeListItem>) => p.data ? <StatusBadge status={p.data.latest_verdict ?? 'UNKNOWN'} /> : null },
    { headerName: 'Due', field: 'seller_response_due_date', minWidth: 180, cellRenderer: (p: ICellRendererParams<DisputeListItem>) => <Deadline dueAt={p.data?.seller_response_due_date ?? null} /> },
  ], [returnTo]);
  return <div aria-label="Disputes grid" className="disputes-grid" style={{ width: '100%' }}><style>{'.disputes-grid { --ag-accent-color: var(--signoff-action-primary); } .disputes-grid .ag-cell { display:flex; align-items:center; line-height:1.4; white-space:normal; } .disputes-grid .ag-cell:last-child { overflow-wrap:anywhere; }'}</style><AgGridReact<DisputeListItem> theme={theme} rowData={rows} columnDefs={columns} defaultColDef={{ flex: 1, sortable: true, resizable: true }} domLayout="autoHeight" getRowId={p => p.data.id} /></div>;
};
