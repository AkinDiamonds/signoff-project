import React from 'react';

export interface MoneyAmount {
  value: string;
  currency_code: string;
}

export interface MoneyProps {
  money: MoneyAmount;
  testId?: string;
}

const DECIMAL = /^(-?)(\d+)(\.\d{2})$/;

export function formatMoney(money: MoneyAmount): string {
  const match = DECIMAL.exec(money.value);
  if (!match) {
    return 'Unknown amount';
  }
  const [, sign = '', whole = '', fraction = ''] = match;
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${money.currency_code} ${sign}${grouped}${fraction}`;
}

export const Money: React.FC<MoneyProps> = ({ money, testId }) => (
  <span data-testid={testId} style={{ fontVariantNumeric: 'tabular-nums' }}>
    {formatMoney(money)}
  </span>
);
