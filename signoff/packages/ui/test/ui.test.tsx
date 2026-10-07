// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button, Card, StatusBadge } from '../src';

describe('@signoff/ui components', () => {
  describe('StatusBadge', () => {
    it('always pairs verdict colors with an icon and text label for ALLOW', () => {
      render(<StatusBadge verdict="ALLOW" testId="badge-allow" />);
      const badge = screen.getByTestId('badge-allow');
      expect(badge).toBeTruthy();
      expect(badge.textContent).toContain('✓');
      expect(badge.textContent).toContain('Allowed');
    });

    it('always pairs verdict colors with an icon and text label for NEEDS_APPROVAL', () => {
      render(<StatusBadge verdict="NEEDS_APPROVAL" testId="badge-approval" />);
      const badge = screen.getByTestId('badge-approval');
      expect(badge).toBeTruthy();
      expect(badge.textContent).toContain('⏳');
      expect(badge.textContent).toContain('Needs Approval');
    });

    it('always pairs verdict colors with an icon and text label for DENY', () => {
      render(<StatusBadge verdict="DENY" testId="badge-deny" />);
      const badge = screen.getByTestId('badge-deny');
      expect(badge).toBeTruthy();
      expect(badge.textContent).toContain('✕');
      expect(badge.textContent).toContain('Denied');
    });
  });

  describe('Card', () => {
    it('renders card title and children', () => {
      render(
        <Card title="Dispute Information" testId="test-card">
          <p>Card Content</p>
        </Card>
      );
      expect(screen.getByText('Dispute Information')).toBeTruthy();
      expect(screen.getByText('Card Content')).toBeTruthy();
    });
  });

  describe('Button', () => {
    it('renders button with correct text and supports disabled state', () => {
      render(
        <Button variant="primary" disabled testId="test-btn">
          Submit
        </Button>
      );
      const btn = screen.getByTestId('test-btn');
      expect(btn.textContent).toBe('Submit');
      expect(btn.hasAttribute('disabled')).toBe(true);
    });
  });
});
