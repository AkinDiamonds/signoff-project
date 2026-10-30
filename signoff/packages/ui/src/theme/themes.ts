export type ThemePreset = 'light' | 'dark' | 'orange' | 'green' | 'blue' | 'lime' | 'custom';

export interface ThemeConfig {
  id: ThemePreset;
  label: string;
  previewBg: string;
  previewDot: string;
  sidebar: string;
  sidebarText: string;
  topbar: string;
  topbarText: string;
  appBg: string;
  textPrimary: string;
  navAccent: string;
  actionPrimary: string;
  cardBg: string;
  border: string;
}

export const THEMES: Record<Exclude<ThemePreset, 'custom'>, ThemeConfig> = {
  light: {
    id: 'light',
    label: 'Light',
    previewBg: '#F1F1F1',
    previewDot: '#303030',
    sidebar: '#FFFFFF',
    sidebarText: '#303030',
    topbar: '#FFFFFF',
    topbarText: '#303030',
    appBg: '#F1F1F1',
    textPrimary: '#303030',
    navAccent: '#0F766E',
    actionPrimary: '#303030',
    cardBg: '#FFFFFF',
    border: '#E1E1E1',
  },
  dark: {
    id: 'dark',
    label: 'Dark',
    previewBg: '#1A1A1A',
    previewDot: '#FFFFFF',
    sidebar: '#1A1A1A',
    sidebarText: '#E3E3E3',
    topbar: '#1A1A1A',
    topbarText: '#E3E3E3',
    appBg: '#0D0D0D',
    textPrimary: '#E3E3E3',
    navAccent: '#0F766E',
    actionPrimary: '#303030',
    cardBg: '#1E1E1E',
    border: '#333333',
  },
  orange: {
    id: 'orange',
    label: 'Orange',
    previewBg: '#FF4D15',
    previewDot: '#000000',
    sidebar: '#C84B11',
    sidebarText: '#FFFFFF',
    topbar: '#E8521A',
    topbarText: '#FFFFFF',
    appBg: '#FFF4EF',
    textPrimary: '#303030',
    navAccent: '#FFFFFF',
    actionPrimary: '#C84B11',
    cardBg: '#FFFFFF',
    border: '#FED7C3',
  },
  green: {
    id: 'green',
    label: 'Green',
    previewBg: '#10B981',
    previewDot: '#000000',
    sidebar: '#1A7A4A',
    sidebarText: '#FFFFFF',
    topbar: '#20904F',
    topbarText: '#FFFFFF',
    appBg: '#F0FAF4',
    textPrimary: '#303030',
    navAccent: '#FFFFFF',
    actionPrimary: '#1A7A4A',
    cardBg: '#FFFFFF',
    border: '#C3E6D2',
  },
  blue: {
    id: 'blue',
    label: 'Blue',
    previewBg: '#2563EB',
    previewDot: '#FFFFFF',
    sidebar: '#1A4FA0',
    sidebarText: '#FFFFFF',
    topbar: '#2055B8',
    topbarText: '#FFFFFF',
    appBg: '#EEF3FF',
    textPrimary: '#303030',
    navAccent: '#FFFFFF',
    actionPrimary: '#1A4FA0',
    cardBg: '#FFFFFF',
    border: '#CCD9F6',
  },
  lime: {
    id: 'lime',
    label: 'Lime',
    previewBg: '#84CC16',
    previewDot: '#000000',
    sidebar: '#4A7A00',
    sidebarText: '#FFFFFF',
    topbar: '#5A9200',
    topbarText: '#FFFFFF',
    appBg: '#F6FFEB',
    textPrimary: '#303030',
    navAccent: '#FFFFFF',
    actionPrimary: '#4A7A00',
    cardBg: '#FFFFFF',
    border: '#D9EEBD',
  },
};

export function buildCustomTheme(hex: string): ThemeConfig {
  return {
    id: 'custom',
    label: 'Custom',
    previewBg: hex,
    previewDot: '#FFFFFF',
    sidebar: hex,
    sidebarText: '#FFFFFF',
    topbar: hex,
    topbarText: '#FFFFFF',
    appBg: '#F8F9FA',
    textPrimary: '#303030',
    navAccent: '#FFFFFF',
    actionPrimary: hex,
    cardBg: '#FFFFFF',
    border: '#E1E1E1',
  };
}

export function getThemeConfig(preset: ThemePreset, customColour?: string): ThemeConfig {
  if (preset === 'custom') {
    return buildCustomTheme(customColour || '#0F766E');
  }
  return THEMES[preset] || THEMES.light;
}

export function applyTheme(preset: ThemePreset, customColour?: string): void {
  if (typeof document === 'undefined') return;
  const cfg = getThemeConfig(preset, customColour);
  const root = document.documentElement;

  root.style.setProperty('--signoff-sidebar', cfg.sidebar);
  root.style.setProperty('--signoff-sidebar-text', cfg.sidebarText);
  root.style.setProperty('--signoff-topbar', cfg.topbar);
  root.style.setProperty('--signoff-topbar-text', cfg.topbarText);
  root.style.setProperty('--signoff-app-bg', cfg.appBg);
  root.style.setProperty('--signoff-text-primary', cfg.textPrimary);
  root.style.setProperty('--signoff-nav-accent', cfg.navAccent);
  root.style.setProperty('--signoff-action-primary', cfg.actionPrimary);
  root.style.setProperty('--signoff-card-bg', cfg.cardBg);
  root.style.setProperty('--signoff-border', cfg.border);
  root.setAttribute('data-theme', preset);
}

