import React from 'react';

export interface TruncatedTextProps {
  text: string;
  maxWidth?: string;
  testId?: string;
}

export const TruncatedText: React.FC<TruncatedTextProps> = ({
  text,
  maxWidth = '100%',
  testId,
}) => (
  <span
    title={text}
    data-testid={testId}
    style={{
      display: 'inline-block',
      maxWidth,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      verticalAlign: 'bottom',
    }}
  >
    {text}
  </span>
);
