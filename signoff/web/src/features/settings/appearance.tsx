import React, { createContext, useContext, useEffect, useState } from 'react';
export type Display = 'light' | 'dark' | 'device';
export type Accent = 'forest' | 'blue' | 'violet' | 'slate';
const accents: Record<Accent, string> = { forest: '#14532d', blue: '#1d4ed8', violet: '#6d28d9', slate: '#334155' };
type Appearance = { display: Display; accent: Accent; apply: (display: Display, accent: Accent) => void };
const Context = createContext<Appearance>({ display: 'light', accent: 'forest', apply: () => {} });
export const useAppearance = () => useContext(Context);
export const AppearanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [display, setDisplay] = useState<Display>(() => { const v = localStorage.getItem('signoff-display'); return v === 'dark' || v === 'device' ? v : 'light'; });
  const [accent, setAccent] = useState<Accent>(() => { const v = localStorage.getItem('signoff-accent'); return v === 'blue' || v === 'violet' || v === 'slate' ? v : 'forest'; });
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const update = () => { document.documentElement.dataset.display = display === 'device' ? (media?.matches ? 'dark' : 'light') : display; };
    update(); media?.addEventListener?.('change', update); return () => media?.removeEventListener?.('change', update);
  }, [display]);
  useEffect(() => { document.documentElement.style.setProperty('--signoff-action-primary', accents[accent]); }, [accent]);
  const apply = (nextDisplay: Display, nextAccent: Accent) => { setDisplay(nextDisplay); setAccent(nextAccent); localStorage.setItem('signoff-display', nextDisplay); localStorage.setItem('signoff-accent', nextAccent); };
  return <Context.Provider value={{ display, accent, apply }}>{children}</Context.Provider>;
};
