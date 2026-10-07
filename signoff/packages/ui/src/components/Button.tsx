import React from 'react';
import { colors, spacing } from '../tokens';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  testId?: string;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  testId,
  style,
  disabled,
  ...props
}) => {
  let bg: string = colors.brandPrimary;
  let text: string = '#FFFFFF';
  let border = 'transparent';

  if (variant === 'secondary') {
    bg = colors.surfaceSubtle;
    text = colors.ink;
    border = colors.border;
  } else if (variant === 'danger') {
    bg = colors.verdict.DENY.bg;
    text = colors.verdict.DENY.text;
    border = colors.verdict.DENY.border;
  }

  return (
    <button
      data-testid={testId}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: `8px ${spacing[2]}`,
        borderRadius: '6px',
        fontSize: '14px',
        fontWeight: 500,
        backgroundColor: bg,
        color: text,
        border: `1px solid ${border}`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'background-color 0.15s ease',
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  );
};
