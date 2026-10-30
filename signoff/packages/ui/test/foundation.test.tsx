// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  DataTable,
  PageHeader,
  StatusBadge,
  ThemeProvider,
  ThemeToggleButton,
  colors,
  radius,
  typography,
} from '../src';

describe('UI Foundation (Shopify tokens & components)', () => {
  it('exposes Shopify measured tokens', () => {
    expect(colors.appBackground).toBe('#F1F1F1');
    expect(colors.surface).toBe('#FFFFFF');
    expect(colors.border).toBe('#E1E1E1');
    expect(colors.ink).toBe('#303030');
    expect(colors.verdict.ALLOW.bg).toBe('#AEE9D1');
    expect(radius.card).toBe('8px');
    expect(typography.rowHeight).toBe('44px');
  });

  it('renders PageHeader with title and description', () => {
    render(
      <PageHeader
        title="Disputes"
        description="What needs you today."
        testId="header-test"
      />
    );
    expect(screen.getByText('Disputes')).toBeTruthy();
    expect(screen.getByText('What needs you today.')).toBeTruthy();
  });

  it('renders DataTable with headers and row cells', () => {
    interface Item {
      id: string;
      title: string;
      amount: string;
    }
    const data: Item[] = [
      { id: '1', title: 'Item 1', amount: 'USD 25.00' },
      { id: '2', title: 'Item 2', amount: 'USD 50.00' },
    ];
    const columns = [
      { id: 'title', header: 'Item Title', cell: (r: Item) => r.title },
      { id: 'amount', header: 'Amount', numeric: true, cell: (r: Item) => r.amount },
    ];

    render(
      <DataTable
        columns={columns}
        data={data}
        keyExtractor={(r) => r.id}
        caption="Sample table"
        testId="data-table-test"
      />
    );

    expect(screen.getByText('Item Title')).toBeTruthy();
    expect(screen.getByText('Item 1')).toBeTruthy();
    expect(screen.getByText('USD 50.00')).toBeTruthy();
  });

  it('renders ThemeToggleButton within ThemeProvider', () => {
    render(
      <ThemeProvider>
        <ThemeToggleButton />
      </ThemeProvider>
    );
    expect(screen.getByTestId('theme-toggle-button')).toBeTruthy();
  });
});

