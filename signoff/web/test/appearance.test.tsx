// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AppearanceProvider } from '../src/features/settings/appearance';
import { AppearancePage } from '../src/features/settings/AppearancePage';

afterEach(() => { cleanup(); localStorage.clear(); });
it('previews choices without applying them and persists them on apply', () => {
  render(<MemoryRouter><AppearanceProvider><AppearancePage /></AppearanceProvider></MemoryRouter>);
  fireEvent.click(screen.getByLabelText('Dark'));
  fireEvent.click(screen.getByLabelText('Violet'));
  expect(localStorage.getItem('signoff-display')).toBeNull();
  expect(localStorage.getItem('signoff-accent')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Apply appearance' }));
  expect(localStorage.getItem('signoff-display')).toBe('dark');
  expect(localStorage.getItem('signoff-accent')).toBe('violet');
  expect(document.documentElement.dataset.display).toBe('dark');
  expect(screen.getByRole('status').textContent).toContain('saved');
});
