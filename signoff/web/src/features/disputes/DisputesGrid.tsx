import React, { useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router';
import { AllCommunityModule, ModuleRegistry, themeQuartz } from 'ag-grid-community';
import type { ColDef, GetContextMenuItemsParams, GridApi, GridReadyEvent, GridState, ICellRendererParams, RowClickedEvent, SideBarDef, StatusPanelDef } from 'ag-grid-community';
import {
  ColumnMenuModule, ColumnsToolPanelModule, ContextMenuModule, FiltersToolPanelModule,
  RowGroupingModule, SetFilterModule, SideBarModule, StatusBarModule,
} from 'ag-grid-enterprise';
import { AgGridReact } from 'ag-grid-react';
import type { CustomStatusPanelProps } from 'ag-grid-react';
import { Button, ConceptPill, concept, disputePill, formatDisputeReason, formatDueShort, formatMoney } from '@signoff/ui';
import { classifyDeadline } from '../widgets';
import type { DisputeListItem } from './types';

ModuleRegistry.registerModules([
  AllCommunityModule, SideBarModule, ColumnsToolPanelModule, FiltersToolPanelModule, StatusBarModule,
  RowGroupingModule, SetFilterModule, ContextMenuModule, ColumnMenuModule,
]);

// Every colour is a Signoff CSS variable, so dark mode and the accent setting restyle the grid with no extra code.
const theme = themeQuartz.withParams({
  accentColor: 'var(--signoff-action-primary, #135e3d)',
  backgroundColor: 'var(--signoff-surface, #fff)',
  foregroundColor: 'var(--signoff-ink, #1b1b19)',
  borderColor: 'var(--signoff-divider, #e7e6e2)',
  headerBackgroundColor: 'var(--signoff-subtle, #f6f6f5)',
  headerTextColor: 'var(--signoff-muted, #6b6b66)',
  headerFontWeight: 600,
  rowHoverColor: 'var(--signoff-subtle, #f6f6f5)',
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 15,
  rowHeight: 56,
  headerHeight: 44,
  wrapperBorderRadius: 12,
  spacing: 8,
});

const ROW_HEIGHT = 56;
const OVERHEAD = 44 + 48;

const amountOf = (item: DisputeListItem) => Number.parseFloat(item.amount.value);
const dueTime = (item: DisputeListItem) => (item.seller_response_due_date ? Date.parse(item.seller_response_due_date) : null);
const caseName = (item: DisputeListItem) => item.order_code || item.id;

function loadState(key: string): GridState | undefined {
  try {
    const saved: GridState | null = JSON.parse(localStorage.getItem(key) ?? 'null');
    return saved && typeof saved === 'object' ? saved : undefined;
  } catch {
    return undefined;
  }
}

function serialise(state: GridState): string {
  const { columnOrder, columnSizing, columnVisibility, columnPinning, sort, rowGroup } = state;
  return JSON.stringify({ columnOrder, columnSizing, columnVisibility, columnPinning, sort, rowGroup });
}

// Per-currency totals of the rows currently shown (filters included); never adds different currencies together.
const TotalAtStake: React.FC<CustomStatusPanelProps<DisputeListItem>> = ({ api }) => {
  const [text, setText] = React.useState('');
  React.useEffect(() => {
    const update = () => {
      const totals = new Map<string, number>();
      api.forEachNodeAfterFilter(node => {
        if (node.data) totals.set(node.data.amount.currency_code, (totals.get(node.data.amount.currency_code) ?? 0) + amountOf(node.data));
      });
      setText([...totals].map(([currency, total]) => formatMoney({ value: total.toFixed(2), currency_code: currency })).join(' · '));
    };
    update();
    api.addEventListener('modelUpdated', update);
    return () => { if (!api.isDestroyed()) api.removeEventListener('modelUpdated', update); };
  }, [api]);
  return <span style={{ padding: '0 12px', alignSelf: 'center' }}>Value shown: <strong>{text || '—'}</strong></span>;
};

const SIDE_BAR: SideBarDef = { toolPanels: ['columns', 'filters'], defaultToolPanel: '' };
const STATUS_PANELS: StatusPanelDef[] = [{ statusPanel: 'agTotalAndFilteredRowCountComponent', align: 'left' }, { statusPanel: TotalAtStake, align: 'right' }];

export const DisputesGrid: React.FC<{ rows: DisputeListItem[]; returnTo: string; compact?: boolean }> = ({ rows, returnTo, compact = false }) => {
  const navigate = useNavigate();
  const api = useRef<GridApi<DisputeListItem> | null>(null);
  const [layoutVersion, setLayoutVersion] = React.useState(0);
  const storageKey = compact ? 'signoff-disputes-grid-compact' : 'signoff-disputes-grid';
  const open = useCallback((id: string) => void navigate(`/app/disputes/${id}`, { state: { from: returnTo, scrollY: window.scrollY } }), [navigate, returnTo]);

  const saved = useMemo(() => loadState(storageKey), [storageKey, layoutVersion]);
  const fit = (flex: number, width: number) => (compact || flex === 0 ? { width } : { flex });
  const columns = useMemo<ColDef<DisputeListItem>[]>(() => [
    {
      colId: 'case', headerName: 'Case', pinned: 'left', minWidth: 130, ...fit(1.2, 150),
      valueGetter: p => (p.data ? caseName(p.data) : undefined),
      cellRenderer: (p: ICellRendererParams<DisputeListItem>) => {
        const item = p.data;
        if (!item) return p.value;
        return <a href={`/app/disputes/${item.id}`} data-testid={`dispute-row-${item.id}`} onClick={event => { event.preventDefault(); open(item.id); }} style={{ color: concept.primary, fontWeight: 650 }}>{caseName(item)}</a>;
      },
    },
    {
      colId: 'amount', headerName: 'Amount', minWidth: 110, ...fit(0, 135), type: 'rightAligned', filter: 'agNumberColumnFilter',
      valueGetter: p => (p.data ? amountOf(p.data) : undefined),
      valueFormatter: p => (p.data ? formatMoney(p.data.amount) : ''),
      cellStyle: { fontVariantNumeric: 'tabular-nums', fontWeight: 650 },
    },
    {
      colId: 'reason', headerName: 'Buyer reason', minWidth: 200, ...fit(1.5, 220), hide: compact, filter: 'agSetColumnFilter',
      valueGetter: p => (p.data ? formatDisputeReason(p.data.reason) : undefined),
    },
    {
      colId: 'status', headerName: 'Status', minWidth: 190, ...fit(1.3, 210), enableRowGroup: true, filter: 'agSetColumnFilter', enableCellChangeFlash: true,
      valueGetter: p => (p.data ? disputePill(p.data).label : undefined),
      cellRenderer: (p: ICellRendererParams<DisputeListItem>) => p.data ? <ConceptPill tone={disputePill(p.data).tone}>{p.value}</ConceptPill> : p.value,
    },
    {
      colId: 'due', headerName: 'Due', minWidth: 120, ...fit(1, 130), filter: 'agDateColumnFilter',
      valueGetter: p => (p.data ? dueTime(p.data) : undefined),
      filterValueGetter: p => { const time = p.data ? dueTime(p.data) : null; return time === null ? null : new Date(time); },
      cellRenderer: (p: ICellRendererParams<DisputeListItem>) => {
        if (!p.data) return null;
        const urgency = classifyDeadline(p.data.seller_response_due_date ?? null, new Date());
        const tone = urgency === 'OVERDUE' ? 'red' : urgency === 'DUE_SOON' ? 'amber' : 'gray';
        return <ConceptPill tone={tone}>{formatDueShort(p.data.seller_response_due_date)}</ConceptPill>;
      },
      comparator: (a: number | null, b: number | null) => (a ?? Infinity) - (b ?? Infinity),
    },
  ], [compact, open]);

  const onGridReady = (event: GridReadyEvent<DisputeListItem>) => { api.current = event.api; };
  const onRowClicked = (event: RowClickedEvent<DisputeListItem>) => {
    const target = event.event?.target;
    if (event.data && !(target instanceof Element && target.closest('a'))) open(event.data.id);
  };
  const contextMenu = (params: GetContextMenuItemsParams<DisputeListItem>) => {
    const item = params.node?.data;
    return [
      ...(item ? [
        { name: 'Open case', action: () => open(item.id) },
        { name: 'Copy dispute ID', action: () => void navigator.clipboard?.writeText(item.id) },
        'separator' as const,
      ] : []),
      'csvExport' as const,
    ];
  };
  const reset = () => { localStorage.removeItem(storageKey); setLayoutVersion(version => version + 1); };

  const height = Math.min(Math.max(rows.length * ROW_HEIGHT + OVERHEAD, 340), 700);
  return (
    <div aria-label="Disputes grid" data-testid="disputes-grid" style={{ display: 'grid', gap: 10, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button variant="secondary" testId="grid-export" onClick={() => api.current?.exportDataAsCsv({ fileName: 'signoff-disputes.csv' })}>Export CSV</Button>
        <Button variant="secondary" testId="grid-reset" onClick={reset}>Reset layout</Button>
      </div>
      <div style={compact ? undefined : { height }}>
        <AgGridReact<DisputeListItem>
          key={layoutVersion}
          theme={theme}
          rowData={rows}
          columnDefs={columns}
          defaultColDef={{ sortable: true, resizable: true, suppressHeaderMenuButton: compact, suppressHeaderFilterButton: compact }}
          getRowId={params => params.data.id}
          domLayout={compact ? 'autoHeight' : 'normal'}
          rowHeight={ROW_HEIGHT}
          onGridReady={onGridReady}
          onRowClicked={onRowClicked}
          {...(saved ? { initialState: saved } : {})}
          onStateUpdated={event => localStorage.setItem(storageKey, serialise(event.state))}
          {...(compact ? {} : { sideBar: SIDE_BAR, statusBar: { statusPanels: STATUS_PANELS } })}
          getContextMenuItems={contextMenu}
          groupDisplayType="singleColumn"
          autoGroupColumnDef={{ headerName: 'Group', minWidth: 220 }}
          suppressMovableColumns={compact}
          animateRows={!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches}
        />
      </div>
    </div>
  );
};
