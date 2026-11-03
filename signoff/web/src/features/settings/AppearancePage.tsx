import React, { useState } from 'react';
import { Link } from 'react-router';
import { Button, PageHeader } from '@signoff/ui';
import { useAppearance, type Accent, type Display } from './appearance';

const accents: { value: Accent; label: string; color: string }[] = [
  { value: 'forest', label: 'Forest', color: '#1F5A42' },
  { value: 'blue', label: 'Blue', color: '#1d4ed8' },
  { value: 'violet', label: 'Violet', color: '#6d28d9' },
  { value: 'slate', label: 'Slate', color: '#334155' },
];
export const AppearancePage: React.FC = () => {
  const appearance = useAppearance();
  const [display, setDisplay] = useState<Display>(appearance.display);
  const [accent, setAccent] = useState<Accent>(appearance.accent);
  const [saved, setSaved] = useState(false);
  const preview = accents.find(item => item.value === accent)?.color ?? '#1F5A42';
  return <div style={{ maxWidth: 720, display: 'grid', gap: 24 }}>
    <Link to="/app/settings" style={{ color: 'var(--signoff-action-primary)', fontWeight: 600 }}>← Settings</Link>
    <PageHeader title="Appearance" description="Choose how Signoff looks on this device." />
    <fieldset style={{ border: 0, padding: 0, margin: 0 }}><legend style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Display</legend>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
        {([['light', 'Light'], ['dark', 'Dark'], ['device', 'Use device setting']] as const).map(([value, label]) => <label key={value} style={{ display: 'grid', gap: 8, padding: 12, minHeight: 100, border: `1px solid ${display === value ? preview : '#8b8b83'}`, borderRadius: 6, cursor: 'pointer' }}>
          <span aria-hidden="true" style={{ height: 36, borderRadius: 4, background: value === 'dark' ? '#222' : value === 'device' ? 'linear-gradient(135deg, #fff 50%, #222 50%)' : '#f7f7f5', border: '1px solid #aaa' }} />
          <span><input type="radio" name="display" value={value} checked={display === value} onChange={() => { setDisplay(value); setSaved(false); }} /> {label}</span>
        </label>)}
      </div>
    </fieldset>
    <fieldset style={{ border: 0, padding: 0, margin: 0 }}><legend style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Accent color</legend>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>{accents.map(item => <label key={item.value} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 48, cursor: 'pointer' }}><input type="radio" name="accent" value={item.value} checked={accent === item.value} onChange={() => { setAccent(item.value); setSaved(false); }} /><span aria-hidden="true" style={{ background: item.color, color: '#fff', width: 32, height: 32, borderRadius: '50%', display: 'grid', placeItems: 'center' }}>{accent === item.value ? '✓' : ''}</span>{item.label}</label>)}</div>
    </fieldset>
    <section aria-label="Appearance preview" style={{ padding: 20, border: '1px solid #cbd5d0', borderRadius: 8, background: display === 'dark' || (display === 'device' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) ? '#19221c' : '#fff', color: display === 'dark' || (display === 'device' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) ? '#fff' : '#17201b' }}>
      <strong>Preview · example case</strong><p>Order EXAMPLE-01 · USD 24.00<br />Item not received · Review case</p><span style={{ display: 'inline-block', padding: '12px 18px', background: preview, color: '#fff', borderRadius: 6, fontWeight: 600 }}>Review dispute</span>
    </section>
    <div><Button disabled={display === appearance.display && accent === appearance.accent} onClick={() => { appearance.apply(display, accent); setSaved(true); }}>Apply appearance</Button>{saved && <p role="status">Appearance saved.</p>}</div>
  </div>;
};
