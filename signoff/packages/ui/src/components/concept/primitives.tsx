import React from 'react';
import { ConceptIcon, type ConceptIconName } from './ConceptIcon';
import { concept, conceptType, pillColors, type PillTone } from './conceptTokens';

type AnyProps = Record<string, unknown>;

export const ConceptPageTitle: React.FC<{ title: string; subtitle?: string; badge?: React.ReactNode; back?: React.ReactNode; testId?: string | undefined }> = ({ title, subtitle, badge, back, testId }) => (
  <header data-testid={testId} style={{ display: 'grid', gap: 8 }}>
    {back}
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 14, rowGap: 6 }}>
      <h1 style={{ margin: 0, color: concept.ink, ...conceptType.pageTitle }}>{title}</h1>
      {badge}
    </div>
    {subtitle ? <p style={{ margin: 0, fontSize: 16, color: concept.muted }}>{subtitle}</p> : null}
  </header>
);

export const ConceptCard: React.FC<{ children: React.ReactNode; padding?: number | string; as?: React.ElementType; testId?: string | undefined; style?: React.CSSProperties } & AnyProps> = ({ children, padding = 18, as: Tag = 'div', testId, style, ...rest }) => (
  <Tag data-testid={testId} style={{ background: concept.surface, border: `1px solid ${concept.border}`, borderRadius: 16, padding, color: concept.ink, ...style }} {...rest}>{children}</Tag>
);

export const ConceptSectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 style={{ margin: 0, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: concept.muted }}>{children}</h2>
);

export const ConceptSectionHeading: React.FC<{ children: React.ReactNode; id?: string }> = ({ children, id }) => (
  <h2 id={id} style={{ margin: 0, color: concept.ink, ...conceptType.section }}>{children}</h2>
);

export const ConceptListGroup: React.FC<{ children: React.ReactNode; testId?: string | undefined; label?: string }> = ({ children, testId, label }) => (
  <div data-testid={testId} role={label ? 'group' : undefined} aria-label={label} style={{ background: concept.surface, border: `1px solid ${concept.border}`, borderRadius: 16, overflow: 'hidden' }}>
    {React.Children.toArray(children).map((child, index) => <div key={index} style={{ borderTop: index === 0 ? 'none' : `1px solid ${concept.border}` }}>{child}</div>)}
  </div>
);

export const ConceptListRow: React.FC<{ icon?: ConceptIconName; title: React.ReactNode; subtitle?: React.ReactNode; trailing?: 'chevron' | 'external' | React.ReactNode; as?: React.ElementType; testId?: string | undefined } & AnyProps> = ({ icon, title, subtitle, trailing = 'chevron', as: Tag = 'div', testId, ...rest }) => (
  <Tag data-testid={testId} style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 64, padding: '16px 18px', color: concept.ink, textDecoration: 'none', background: 'transparent', border: 0, width: '100%', textAlign: 'left', font: 'inherit', cursor: Tag === 'div' ? 'default' : 'pointer' }} {...rest}>
    {icon ? <ConceptIcon name={icon} /> : null}
    <span style={{ flex: 1, minWidth: 0, display: 'grid', gap: 2 }}>
      <span style={{ fontSize: 17, fontWeight: 650 }}>{title}</span>
      {subtitle ? <span style={{ fontSize: 14, color: concept.muted }}>{subtitle}</span> : null}
    </span>
    {trailing === 'chevron' ? <ConceptIcon name="chevron-right" color={concept.muted} /> : trailing === 'external' ? <ConceptIcon name="external-link" color={concept.muted} /> : trailing}
  </Tag>
);

export const ConceptPill: React.FC<{ tone: PillTone; children: React.ReactNode; uppercase?: boolean; testId?: string | undefined }> = ({ tone, children, uppercase, testId }) => (
  <span data-testid={testId} style={{ display: 'inline-flex', alignItems: 'center', background: pillColors[tone].bg, color: pillColors[tone].text, borderRadius: 8, padding: '5px 10px', fontSize: 14, fontWeight: 550, lineHeight: 1.3, textTransform: uppercase ? 'uppercase' : undefined, letterSpacing: uppercase ? '0.04em' : undefined, whiteSpace: 'nowrap' }}>{children}</span>
);

export interface ConceptSegmentedOption { value: string; label: string }
export const ConceptSegmented: React.FC<{ options: ConceptSegmentedOption[]; value: string; onChange: (value: string) => void; ariaLabel: string; tabs?: boolean; idPrefix?: string; testId?: string | undefined }> = ({ options, value, onChange, ariaLabel, tabs, idPrefix = 'segment', testId }) => {
  const move = (event: React.KeyboardEvent, index: number) => {
    const next = event.key === 'ArrowRight' ? index + 1 : event.key === 'ArrowLeft' ? index - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    const target = options[(next + options.length) % options.length];
    if (target) { onChange(target.value); document.getElementById(`${idPrefix}-${target.value}`)?.focus(); }
  };
  return (
    <div role={tabs ? 'tablist' : 'group'} aria-label={ariaLabel} data-testid={testId} style={{ display: 'grid', gridTemplateColumns: `repeat(${options.length}, 1fr)`, gap: 4, padding: 4, background: concept.track, borderRadius: 12 }}>
      {options.map((option, index) => {
        const active = option.value === value;
        return (
          <button key={option.value} id={`${idPrefix}-${option.value}`} type="button" role={tabs ? 'tab' : undefined} aria-selected={tabs ? active : undefined} aria-pressed={tabs ? undefined : active} aria-controls={tabs ? `${idPrefix}-panel-${option.value}` : undefined} tabIndex={tabs && !active ? -1 : 0} onClick={() => onChange(option.value)} onKeyDown={event => tabs && move(event, index)} style={{ minHeight: 44, border: 0, borderRadius: 9, padding: '0 8px', font: 'inherit', fontSize: 16, fontWeight: active ? 700 : 550, background: active ? concept.primary : 'transparent', color: active ? '#fff' : concept.ink, cursor: 'pointer', whiteSpace: 'nowrap' }}>{option.label}</button>
        );
      })}
    </div>
  );
};

export const ConceptStatTile: React.FC<{ value: React.ReactNode; label: string; note?: string; testId?: string | undefined; valueTestId?: string | undefined }> = ({ value, label, note, testId, valueTestId }) => (
  <div data-testid={testId} style={{ background: concept.subtle, borderRadius: 14, padding: 18, display: 'grid', gap: 4, minWidth: 0 }}>
    <strong data-testid={valueTestId} style={{ fontSize: 'clamp(22px, 6.2vw, 32px)', fontWeight: 750, lineHeight: 1.1, whiteSpace: 'nowrap', color: concept.ink }}>{value}</strong>
    <span style={{ fontSize: 15, color: concept.ink }}>{label}</span>
    {note ? <span style={{ fontSize: 13, color: concept.muted }}>{note}</span> : null}
  </div>
);

export const buttonStyle = (variant: 'primary' | 'secondary' | 'text', fullWidth: boolean, disabled: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, padding: variant === 'text' ? '0 8px' : '0 20px', borderRadius: 10, font: 'inherit', fontSize: 16, fontWeight: 650, textDecoration: 'none', width: fullWidth ? '100%' : undefined, cursor: disabled ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
  border: variant === 'secondary' ? `1px solid ${disabled ? concept.disabledBg : concept.border}` : 0,
  background: disabled ? (variant === 'text' ? 'transparent' : concept.disabledBg) : variant === 'primary' ? concept.primary : variant === 'secondary' ? concept.surface : 'transparent',
  color: disabled ? concept.disabledText : variant === 'primary' ? '#fff' : variant === 'text' ? concept.primary : concept.ink,
});

export const ConceptButton: React.FC<{ variant?: 'primary' | 'secondary' | 'text'; fullWidth?: boolean; as?: React.ElementType; testId?: string | undefined; children: React.ReactNode; style?: React.CSSProperties } & AnyProps> = ({ variant = 'primary', fullWidth = false, as: Tag = 'button', testId, children, disabled, style, ...rest }) => (
  <Tag data-testid={testId} {...(Tag === 'button' ? { type: 'button', disabled: Boolean(disabled) } : {})} style={{ ...buttonStyle(variant, fullWidth, Boolean(disabled)), ...style }} {...rest}>{children}</Tag>
);

export const ConceptSearchField: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { 'data-testid'?: string }> = ({ style, ...props }) => (
  <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
    <span style={{ position: 'absolute', left: 14, top: 15, color: concept.muted, pointerEvents: 'none', display: 'flex' }}><ConceptIcon name="search" /></span>
    <input type="search" {...props} style={{ width: '100%', minHeight: 52, padding: '0 14px 0 44px', border: `1px solid ${concept.border}`, borderRadius: 10, background: concept.surface, color: concept.ink, font: 'inherit', fontSize: 16, ...style }} />
  </div>
);

export const ConceptInfoBanner: React.FC<{ tone?: 'info' | 'warning'; icon?: ConceptIconName; title?: string; children?: React.ReactNode; testId?: string | undefined }> = ({ tone = 'info', icon = 'info', title, children, testId }) => (
  <div data-testid={testId} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: tone === 'warning' ? concept.warningBg : concept.subtle, borderRadius: 12, padding: 16, color: '#1B1B19' }}>
    <ConceptIcon name={icon} size={20} />
    <div style={{ display: 'grid', gap: 2, minWidth: 0, fontSize: 15 }}>
      {title ? <strong style={{ fontSize: 16 }}>{title}</strong> : null}
      {children ? <span>{children}</span> : null}
    </div>
  </div>
);

export const ConceptEmptyState: React.FC<{ icon: ConceptIconName; title: string; body: string; action?: React.ReactNode; testId?: string | undefined }> = ({ icon, title, body, action, testId }) => (
  <ConceptCard testId={testId} padding={32} style={{ display: 'grid', justifyItems: 'center', gap: 12, textAlign: 'center' }}>
    <ConceptIcon name={icon} size={48} strokeWidth={1.5} color={concept.muted} />
    <h3 style={{ margin: 0, ...conceptType.section }}>{title}</h3>
    <p style={{ margin: 0, color: concept.muted }}>{body}</p>
    {action ? <div style={{ width: '100%', marginTop: 8 }}>{action}</div> : null}
  </ConceptCard>
);

export const StoreSwitcherRow: React.FC<{ name?: string }> = ({ name = 'Signoff Shop' }) => (
  <div data-testid="store-switcher" style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, padding: '0 16px', border: `1px solid ${concept.border}`, borderRadius: 12, background: concept.surface, color: concept.ink }}>
    <ConceptIcon name="store" />
    <span style={{ flex: 1, fontSize: 18, fontWeight: 600 }}>{name}</span>
    <ConceptIcon name="chevron-down" color={concept.muted} />
  </div>
);

export const ConceptDisclosure: React.FC<{ icon?: ConceptIconName; title: React.ReactNode; subtitle?: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean; testId?: string | undefined }> = ({ icon, title, subtitle, children, defaultOpen, testId }) => (
  <details data-testid={testId} open={defaultOpen} className="concept-disclosure">
    <summary style={{ listStyle: 'none', display: 'flex', alignItems: 'center', gap: 14, minHeight: 64, padding: '16px 18px', cursor: 'pointer' }}>
      {icon ? <ConceptIcon name={icon} /> : null}
      <span style={{ flex: 1, minWidth: 0, display: 'grid', gap: 2 }}>
        <span style={{ fontSize: 17, fontWeight: 650 }}>{title}</span>
        {subtitle ? <span style={{ fontSize: 14, color: concept.muted }}>{subtitle}</span> : null}
      </span>
      <ConceptIcon name="chevron-down" color={concept.muted} />
    </summary>
    <div style={{ padding: '0 18px 18px' }}>{children}</div>
  </details>
);
