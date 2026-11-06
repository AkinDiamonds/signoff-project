import React from 'react';
import { Link } from 'react-router';
import { concept } from '@signoff/ui';

const TOKEN = /(\*\*[^*\n]+\*\*|PP-D-[A-Za-z0-9-]+|(?:USD|EUR|GBP|INR|NGN)\s?\d[\d,]*(?:\.\d{1,2})?|\$\d[\d,]*(?:\.\d{1,2})?|\d+(?:\.\d+)?%)/g;
const BULLET = /^\s*(?:[-*•]|\d+[.)])\s+/;
const HEADING = /^\s*#{1,6}\s+/;

function inline(text: string, knownIds: ReadonlySet<string>): React.ReactNode[] {
  return text.split(TOKEN).map((part, index) => {
    if (index % 2 === 0) return part;
    if (part.startsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (knownIds.has(part)) return <Link key={index} to={`/app/disputes/${part}`} style={{ color: concept.primary, fontWeight: 650 }}>{part}</Link>;
    return <strong key={index} style={{ fontVariantNumeric: 'tabular-nums' }}>{part}</strong>;
  });
}

type Block = { kind: 'p' | 'h'; text: string } | { kind: 'list'; items: string[] };

function parse(answer: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of answer.replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const last = blocks[blocks.length - 1];
    if (BULLET.test(line)) {
      const item = line.replace(BULLET, '');
      if (last?.kind === 'list') last.items.push(item);
      else blocks.push({ kind: 'list', items: [item] });
    } else if (HEADING.test(line)) blocks.push({ kind: 'h', text: line.replace(HEADING, '') });
    else blocks.push({ kind: 'p', text: line });
  }
  return blocks;
}

export const AnswerView: React.FC<{ answer: string; knownIds?: readonly string[] }> = ({ answer, knownIds = [] }) => {
  const known = new Set(knownIds);
  return (
    <div data-testid="assistant-answer" style={{ background: concept.subtle, borderRadius: 14, padding: '16px 18px', display: 'grid', gap: 10, lineHeight: 1.55, fontSize: 16, borderLeft: `4px solid ${concept.primary}`, overflowWrap: 'anywhere' }}>
      <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: concept.muted }}>Assistant · read-only</span>
      {parse(answer).map((block, index) => block.kind === 'list'
        ? <ul key={index} style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 6 }}>{block.items.map((item, i) => <li key={i}>{inline(item, known)}</li>)}</ul>
        : <p key={index} style={{ margin: 0, fontWeight: block.kind === 'h' ? 700 : undefined }}>{inline(block.text, known)}</p>)}
    </div>
  );
};
