import React from 'react';
import { useTheme } from './ThemeProvider';

export interface ThemeToggleButtonProps {
  className?: string;
}

export const ThemeToggleButton: React.FC<ThemeToggleButtonProps> = ({ className }) => {
  const { openPicker } = useTheme();

  return (
    <button
      type="button"
      onClick={openPicker}
      aria-label="Change site theme"
      title="Change site theme"
      className={className}
      data-testid="theme-toggle-button"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        border: '1px solid var(--signoff-border, #E1E1E1)',
        backgroundColor: 'transparent',
        cursor: 'pointer',
        padding: 0,
        color: 'var(--signoff-topbar-text, #303030)',
        transition: 'background-color 0.15s ease',
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        {/* Half-filled circle icon: right half filled, left half empty circle */}
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8v16z" />
      </svg>
    </button>
  );
};

