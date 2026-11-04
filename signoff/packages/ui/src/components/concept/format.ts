import type { PillTone } from './conceptTokens';

interface MoneyLike {
  value: string;
  currency_code: string;
}

const ZONE = 'Africa/Lagos';

/** "USD 253" for tiles; keeps cents only when they are not ".00". */
export function formatMoneyCompact(money: MoneyLike, options: { space?: boolean } = {}): string {
  const match = /^(-?)(\d+)(\.\d{2})$/.exec(money.value);
  if (!match) return 'Unknown amount';
  const [, sign = '', whole = '', fraction = ''] = match;
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const amount = `${sign}${grouped}${fraction === '.00' ? '' : fraction}`;
  return `${money.currency_code}${options.space === false ? '' : ' '}${amount}`;
}

function parts(date: Date, options: Intl.DateTimeFormatOptions): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, ...options }).formatToParts(date)) out[part.type] = part.value;
  return out;
}

function validDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "Due 20 Nov", "Overdue" or "No deadline". */
export function formatDueShort(dueAt: string | null | undefined, now: Date = new Date()): string {
  if (!dueAt) return 'No deadline';
  const date = validDate(dueAt);
  if (!date) return 'No deadline';
  if (date.getTime() < now.getTime()) return 'Overdue';
  const p = parts(date, { day: 'numeric', month: 'short' });
  return `Due ${p.day} ${p.month}`;
}

/** "18 Nov · 10:18 PM WAT". */
export function formatDeadlineFull(dueAt: string | null | undefined): string {
  const date = validDate(dueAt);
  if (!date) return 'No deadline';
  const p = parts(date, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
  return `${p.day} ${p.month} · ${p.hour}:${p.minute} ${(p.dayPeriod ?? '').toUpperCase()} WAT`;
}

/** "2 Nov, 10:40 AM" (adds the year when it is not the current one). */
export function formatEventTime(value: string | null | undefined, now: Date = new Date()): string {
  const date = validDate(value);
  if (!date) return '';
  const p = parts(date, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
  const year = p.year !== parts(now, { year: 'numeric' }).year ? ` ${p.year}` : '';
  return `${p.day} ${p.month}${year}, ${p.hour}:${p.minute} ${(p.dayPeriod ?? '').toUpperCase()}`;
}

/** "7:29 AM" today, "Yesterday", otherwise "2 Nov". */
export function formatRelativeDay(value: string | null | undefined, now: Date = new Date()): string {
  const date = validDate(value);
  if (!date) return '';
  const day = (d: Date) => { const p = parts(d, { day: 'numeric', month: 'numeric', year: 'numeric' }); return `${p.year}-${p.month}-${p.day}`; };
  if (day(date) === day(now)) {
    const p = parts(date, { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${p.hour}:${p.minute} ${(p.dayPeriod ?? '').toUpperCase()}`;
  }
  if (day(date) === day(new Date(now.getTime() - 86_400_000))) return 'Yesterday';
  const p = parts(date, { day: 'numeric', month: 'short' });
  return `${p.day} ${p.month}`;
}

export interface DisputePillInput {
  status?: string | null;
  approval_execution_attention?: string | null;
  analysis_needs_review?: boolean | null;
  current_approval_available?: boolean | null;
}

/** One status pill per dispute, by priority. */
export function disputePill(item: DisputePillInput): { tone: PillTone; label: string } {
  if (item.approval_execution_attention === 'FAILED') return { tone: 'red', label: 'Action failed' };
  if (item.approval_execution_attention === 'NOT_RECORDED') return { tone: 'amber', label: 'Check execution' };
  if (item.analysis_needs_review) return { tone: 'amber', label: 'Check analysis' };
  if (item.current_approval_available) return { tone: 'green', label: 'Approval ready' };
  switch (item.status) {
    case 'WAITING_FOR_BUYER_RESPONSE': return { tone: 'blue', label: 'Waiting for buyer' };
    case 'WAITING_FOR_SELLER_RESPONSE': return { tone: 'amber', label: 'Waiting for your response' };
    case 'UNDER_REVIEW': return { tone: 'purple', label: 'Under review' };
    case 'RESOLVED': return { tone: 'green', label: 'Resolved' };
    default: return { tone: 'gray', label: 'Open' };
  }
}
