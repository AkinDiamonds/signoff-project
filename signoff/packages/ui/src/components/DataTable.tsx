import React, { useState } from 'react';
import { colors, radius, spacing, typography } from '../tokens';

export interface ColumnDef<T> {
  id: string;
  header: React.ReactNode;
  cell: (row: T, index: number) => React.ReactNode;
  numeric?: boolean;
  align?: 'left' | 'center' | 'right';
  width?: string | number;
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  keyExtractor: (row: T, index: number) => string;
  rowTestId?: (row: T, index: number) => string;
  caption?: string;
  onRowClick?: (row: T) => void;
  testId?: string;
  tableTestId?: string;
  emptyState?: React.ReactNode;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  rowTestId,
  caption,
  onRowClick,
  testId,
  tableTestId,
  emptyState,
}: DataTableProps<T>) {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  if (!data || data.length === 0) {
    return emptyState ? (
      <div>{emptyState}</div>
    ) : (
      <div
        data-testid={testId}
        style={{
          padding: spacing[3],
          textAlign: 'center',
          color: colors.inkMuted,
          backgroundColor: colors.surface,
          borderRadius: radius.card,
          border: `1px solid ${colors.border}`,
          fontSize: typography.fontSizeBody,
        }}
      >
        No records found.
      </div>
    );
  }

  return (
    <div
      data-testid={testId}
      style={{
        width: '100%',
        overflowX: 'auto',
        backgroundColor: colors.surface,
        borderRadius: radius.card,
        border: `1px solid ${colors.border}`,
        boxShadow: '0 1px 0 rgba(0, 0, 0, 0.05)',
      }}
    >
      <table
        data-testid={tableTestId}
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          textAlign: 'left',
          fontSize: typography.fontSizeBody,
          fontFamily: typography.fontFamily,
        }}
      >
        {caption && (
          <caption
            style={{
              position: 'absolute',
              width: '1px',
              height: '1px',
              padding: 0,
              margin: '-1px',
              overflow: 'hidden',
              clip: 'rect(0, 0, 0, 0)',
              whiteSpace: 'nowrap',
              border: 0,
            }}
          >
            {caption}
          </caption>
        )}
        <thead>
          <tr
            style={{
              borderBottom: `1px solid ${colors.border}`,
              backgroundColor: colors.surface,
              height: '36px',
            }}
          >
            {columns.map((col) => {
              const align = col.numeric ? 'right' : col.align || 'left';
              return (
                <th
                  key={col.id}
                  scope="col"
                  style={{
                    padding: `0 ${spacing[2]}`,
                    fontSize: typography.fontSizeSmall,
                    fontWeight: typography.fontWeightSemibold,
                    color: colors.inkMuted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    textAlign: align,
                    width: col.width,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {col.header}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => {
            const key = keyExtractor(row, idx);
            const isHovered = hoveredRow === key;

            return (
              <tr
                key={key}
                data-testid={rowTestId ? rowTestId(row, idx) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                role={onRowClick ? 'button' : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
                onMouseEnter={() => setHoveredRow(key)}
                onMouseLeave={() => setHoveredRow(null)}
                style={{
                  height: typography.rowHeight,
                  borderBottom:
                    idx === data.length - 1 ? 'none' : `1px solid ${colors.border}`,
                  backgroundColor: isHovered ? '#FAFAFA' : 'transparent',
                  cursor: onRowClick ? 'pointer' : 'default',
                  outline: 'none',
                  transition: 'background-color 0.1s ease',
                }}
              >
                {columns.map((col) => {
                  const align = col.numeric ? 'right' : col.align || 'left';
                  return (
                    <td
                      key={col.id}
                      style={{
                        padding: `0 ${spacing[2]}`,
                        color: colors.ink,
                        textAlign: align,
                        fontVariantNumeric: col.numeric ? 'tabular-nums' : undefined,
                        verticalAlign: 'middle',
                      }}
                    >
                      {col.cell(row, idx)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

