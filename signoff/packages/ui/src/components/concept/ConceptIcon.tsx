import React from 'react';

export type ConceptIconName =
  | 'store' | 'chevron-down' | 'chevron-right' | 'chevron-left' | 'search' | 'filter' | 'home' | 'disputes' | 'bell'
  | 'more' | 'calendar' | 'clock' | 'chart' | 'truck' | 'sliders' | 'gear' | 'help-circle' | 'layers' | 'file'
  | 'external-link' | 'user' | 'link' | 'shield' | 'monitor' | 'phone' | 'message' | 'alert-triangle' | 'check'
  | 'folder' | 'lock' | 'info' | 'arrow-right' | 'quote';

const PATHS: Record<ConceptIconName, React.ReactNode> = {
  store: <><path d="M4 9.5 5.5 4h13L20 9.5" /><path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0" /><path d="M5.5 12.5V20h13v-7.5M10 20v-4h4v4" /></>,
  'chevron-down': <path d="m6 9 6 6 6-6" />,
  'chevron-right': <path d="m9 6 6 6-6 6" />,
  'chevron-left': <path d="m15 6-6 6 6 6" />,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>,
  filter: <path d="M4 5h16l-6 8v6l-4-2v-4L4 5Z" />,
  home: <><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10.5V20h13v-9.5M9.5 20v-6h5v6" /></>,
  disputes: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 9h8M8 13h8M8 17h5" /></>,
  bell: <><path d="M5 17h14l-1.5-2V10a5.5 5.5 0 0 0-11 0v5L5 17Z" /><path d="M10 20h4" /></>,
  more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  calendar: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></>,
  clock: <><circle cx="12" cy="12" r="8" /><path d="M12 7.5V12l3 2" /></>,
  chart: <path d="M5 20V10M12 20V4M19 20v-7" />,
  truck: <><path d="M3 6h11v10H3zM14 9h4l3 3v4h-7" /><circle cx="7" cy="17.5" r="1.7" /><circle cx="17" cy="17.5" r="1.7" /></>,
  sliders: <><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" /></>,
  'help-circle': <><circle cx="12" cy="12" r="8.5" /><path d="M9.7 9.5a2.4 2.4 0 1 1 3.4 2.2c-.7.4-1.1.9-1.1 1.8M12 16.8v.1" /></>,
  layers: <><path d="m12 4 9 5-9 5-9-5 9-5Z" /><path d="m3 14 9 5 9-5" /></>,
  file: <><path d="M7 3.5h7l4 4V20.5H7z" /><path d="M14 3.5v4h4M9.5 12h5M9.5 16h5" /></>,
  'external-link': <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>,
  user: <><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c.8-3.6 3.3-5.5 7-5.5s6.2 1.9 7 5.5" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1" /></>,
  shield: <><path d="M12 3.5 5 6v5.5c0 4.2 2.9 7.4 7 9 4.1-1.6 7-4.8 7-9V6l-7-2.5Z" /><path d="m9 12 2.2 2.2L15 10.5" /></>,
  monitor: <><rect x="3.5" y="4.5" width="17" height="12" rx="2" /><path d="M9 20h6M12 16.5V20" /></>,
  phone: <><rect x="7" y="3" width="10" height="18" rx="2" /><path d="M11 18h2" /></>,
  message: <path d="M4 5.5h16v10H9l-5 4v-14Z" />,
  'alert-triangle': <><path d="M12 4 3 19h18L12 4Z" /><path d="M12 10v4M12 16.8v.1" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  folder: <path d="M3.5 6.5h6l2 2.5h9v9.5h-17z" />,
  lock: <><rect x="5" y="10.5" width="14" height="9.5" rx="2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>,
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8v.1" /></>,
  'arrow-right': <path d="M5 12h14M13 6l6 6-6 6" />,
  quote: <path d="M5 18v-5.5C5 8.5 7 6 10 5.5M14 18v-5.5c0-4 2-6.5 5-7" />,
};

export interface ConceptIconProps {
  name: ConceptIconName;
  size?: number;
  strokeWidth?: number;
  color?: string;
  style?: React.CSSProperties;
}

export const ConceptIcon: React.FC<ConceptIconProps> = ({ name, size = 22, strokeWidth = 1.8, color = 'currentColor', style }) => (
  <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', ...style }}>
    {PATHS[name]}
  </svg>
);
