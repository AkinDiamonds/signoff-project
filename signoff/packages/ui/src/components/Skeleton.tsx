import React from 'react';
import { colors } from '../tokens';

export interface SkeletonProps {
  width?: string;
  height?: string;
  testId?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ width = '100%', height = '16px', testId }) => (
  <div
    aria-hidden="true"
    data-testid={testId}
    style={{ width, height, borderRadius: '4px', backgroundColor: colors.border, margin: '8px 0' }}
  />
);
