import React, { useState } from 'react';
import { Link } from 'react-router';
import { ConceptButton, ConceptCard, ConceptIcon, ConceptPageTitle, ConceptPill, ConceptSectionHeading, concept } from '@signoff/ui';
import { useAppearance, type Accent, type Display } from './appearance';

const accents: { value: Accent; label: string; color: string }[] = [
  { value: 'forest', label: 'Forest', color: '#135E3D' },
  { value: 'blue', label: 'Blue', color: '#1d4ed8' },
  { value: 'violet', label: 'Violet', color: '#6d28d9' },
  { value: 'slate', label: 'Slate', color: '#334155' },
];
const displays: [Display, string, string][] = [['light', 'Light', 'Light'], ['dark', 'Dark', 'Dark'], ['device', 'Device', 'Use device setting']];

const hiddenRadio: React.CSSProperties = { position: 'absolute', opacity: 0, inset: 0, width: '100%', height: '100%', margin: 0, cursor: 'pointer' };
const tile = (selected: boolean): React.CSSProperties => ({ position: 'relative', display: 'grid', alignContent: 'start', justifyItems: 'center', gap: 8, padding: 12, border: `1.5px solid ${selected ? concept.primary : concept.border}`, borderRadius: 12, cursor: 'pointer', background: concept.surface, minWidth: 0, textAlign: 'center' });
const check = (size: number): React.CSSProperties => ({ width: size, height: size, borderRadius: '50%', background: concept.primary, color: '#fff', display: 'grid', placeItems: 'center' });

export const AppearancePage: React.FC = () => {
  const appearance = useAppearance();
  const [display, setDisplay] = useState<Display>(appearance.display);
  const [accent, setAccent] = useState<Accent>(appearance.accent);
  const [saved, setSaved] = useState(false);
  const preview = accents.find(item => item.value === accent)?.color ?? '#135E3D';
  const dark = display === 'dark' || (display === 'device' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  const unchanged = display === appearance.display && accent === appearance.accent;
  return <div style={{ maxWidth: 720, display: 'grid', gap: 24 }}>
    <Link to="/app/settings" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 44, color: concept.primary, fontWeight: 600, textDecoration: 'none' }}><ConceptIcon name="chevron-left" /> Settings</Link>
    <ConceptPageTitle title="Appearance" testId="page-header" />
    <ConceptCard as="fieldset" padding={18} style={{ margin: 0, minWidth: 0 }}>
      <legend style={{ float: 'left', width: '100%', padding: 0, marginBottom: 12 }}><ConceptSectionHeading>Display</ConceptSectionHeading></legend>
      <div style={{ clear: 'both', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
        {displays.map(([value, label, accessible]) => <label key={value} style={{ ...tile(display === value), minHeight: 104 }}>
          <input type="radio" name="display" value={value} aria-label={accessible} checked={display === value} onChange={() => { setDisplay(value); setSaved(false); }} style={hiddenRadio} />
          {display === value && <span aria-hidden="true" style={{ ...check(18), position: 'absolute', top: 8, right: 8 }}><ConceptIcon name="check" size={12} strokeWidth={3} /></span>}
          <span aria-hidden="true" style={{ width: '100%', height: 48, borderRadius: 8, background: value === 'dark' ? '#222' : value === 'device' ? 'linear-gradient(135deg, #fff 50%, #222 50%)' : '#f7f7f5', border: `1px solid ${concept.border}` }} />
          <span aria-hidden="true" style={{ fontSize: 14, fontWeight: 600 }}>{label}</span>
        </label>)}
      </div>
    </ConceptCard>
    <ConceptCard as="fieldset" padding={18} style={{ margin: 0, minWidth: 0 }}>
      <legend style={{ float: 'left', width: '100%', padding: 0, marginBottom: 12 }}><ConceptSectionHeading>Accent</ConceptSectionHeading></legend>
      <div style={{ clear: 'both', display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
        {accents.map(item => <label key={item.value} style={{ ...tile(accent === item.value), padding: '12px 4px' }}>
          <input type="radio" name="accent" value={item.value} aria-label={item.label} checked={accent === item.value} onChange={() => { setAccent(item.value); setSaved(false); }} style={hiddenRadio} />
          <span aria-hidden="true" style={{ background: item.color, color: '#fff', width: 36, height: 36, borderRadius: '50%', display: 'grid', placeItems: 'center' }}>{accent === item.value && <ConceptIcon name="check" size={20} strokeWidth={3} />}</span>
          <span aria-hidden="true" style={{ fontSize: 14 }}>{item.label}</span>
        </label>)}
      </div>
    </ConceptCard>
    <ConceptCard as="section" aria-label="Appearance preview" padding={18} style={{ display: 'grid', gap: 12, background: dark ? '#19221c' : concept.surface, color: dark ? '#fff' : concept.ink }}>
      <ConceptSectionHeading>Preview</ConceptSectionHeading>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 17, fontWeight: 650 }}><span>SIGC5GT7ZA</span><span style={{ whiteSpace: 'nowrap' }}>USD 24.00</span></div>
      <span style={{ fontSize: 14, opacity: 0.8 }}>Item not received</span>
      <div><ConceptPill tone="green">Check execution</ConceptPill></div>
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 48, borderRadius: 10, background: preview, color: '#fff', fontWeight: 650 }}>Inspect case</span>
    </ConceptCard>
    <div style={{ display: 'grid', gap: 8 }}>
      <ConceptButton fullWidth disabled={unchanged} onClick={() => { appearance.apply(display, accent); setSaved(true); }}>Apply appearance</ConceptButton>
      {saved && <p role="status" style={{ margin: 0, textAlign: 'center' }}>Appearance saved.</p>}
    </div>
  </div>;
};
