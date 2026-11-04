// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { ThemeProvider } from '@signoff/ui';
import { LandingPage } from '../src/features/site/LandingPage';
import { GuidePage } from '../src/features/site/GuidePage';
import { ViewSwitcher } from '../src/features/site/ViewSwitcher';
import { statusFixture } from '../../fixtures/ui';

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

describe('Site Feature Components', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('ViewSwitcher', () => {
    it('renders with initial view and switches between merchant and buyer views', () => {
      const onViewChange = vi.fn();
      renderWithProviders(<ViewSwitcher initialView="merchant" onViewChange={onViewChange} />);

      expect(screen.getByTestId('view-switcher')).toBeTruthy();
      expect(screen.getByRole('tab', { name: 'Merchant' }).getAttribute('aria-selected')).toBe('true');
      expect(screen.getByRole('tab', { name: 'Buyer' }).getAttribute('aria-selected')).toBe('false');

      // Click Buyer View
      fireEvent.click(screen.getByRole('tab', { name: 'Buyer' }));
      expect(onViewChange).toHaveBeenCalledWith('buyer');
      expect(screen.getByRole('tab', { name: 'Buyer' }).getAttribute('aria-selected')).toBe('true');
    });

    it('keeps the buyer shop links inside the Help buyer view', () => {
      renderWithProviders(<GuidePage />);
      expect(screen.queryByTestId('view-link-buyer-shop')).toBeNull();
      fireEvent.click(screen.getByRole('tab', { name: 'Buyer' }));
      expect(screen.getByTestId('view-link-buyer-shop')).toBeTruthy();
      expect(screen.getByTestId('view-link-buyer-cart')).toBeTruthy();
      expect(screen.getByTestId('view-link-buyer-portal')).toBeTruthy();
    });
  });

  describe('LandingPage', () => {
    it('renders hero, problem statement, signing limits, pipeline, claims, and status', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify(statusFixture), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      );

      await act(async () => {
        renderWithProviders(<LandingPage />);
      });

      // Hero
      expect(screen.getByRole('heading', { level: 1, name: /Signoff fights PayPal disputes/i })).toBeTruthy();
      const guideCta = screen.getByTestId('landing-cta-guide');
      expect(guideCta.getAttribute('href')).toBe('/guide');
      expect(screen.getByTestId('landing-cta-pool').getAttribute('href')).toBe('/app/pool');

      // Problem section
      expect(screen.getByRole('heading', { name: /PayPal disputes have a deadline/i })).toBeTruthy();
      expect(screen.getByText(/PayPal provides a response deadline for each dispute/i)).toBeTruthy();
      expect(screen.queryByText(/exactly 10 days/i)).toBeNull();
      expect(screen.getByText(/The Hallucination Danger/i)).toBeTruthy();

      // Signing limit idea
      expect(screen.getByRole('heading', { name: /You set the limit\. The rule is hard\./i })).toBeTruthy();
      expect(screen.getByText(/An approval can raise your own limits/i)).toBeTruthy();
      expect(screen.getByText(/An approval can never override PayPal/i)).toBeTruthy();

      // Pipeline (4 steps)
      expect(screen.getByRole('heading', { name: /How it works/i })).toBeTruthy();
      expect(screen.getByText('PayPal opens a dispute')).toBeTruthy();
      expect(screen.getByText('The agent gathers your evidence')).toBeTruthy();
      expect(screen.getByText('Your rules decide what it can do')).toBeTruthy();
      expect(screen.getByText('It acts, or it asks you')).toBeTruthy();

      // Claims
      expect(screen.getByRole('heading', { name: /What we can prove/i })).toBeTruthy();
      expect(screen.getByTestId('claim-card-CLAIM-AI-NO-MUTATING')).toBeTruthy();
      expect(screen.getByTestId('claim-card-CLAIM-GATE-FAIL-CLOSED')).toBeTruthy();

      // Embedded System Status
      expect(screen.getByTestId('home-status-card')).toBeTruthy();
    });
  });

  describe('GuidePage', () => {
    it('renders 5-step numbered path, comparison table, and resource links', () => {
      renderWithProviders(<GuidePage />);

      // Header and resource links
      expect(screen.getByRole('heading', { level: 1, name: /^Help$/i })).toBeTruthy();
      expect(screen.getByTestId('guide-link-repo').getAttribute('href')).toContain('github.com');
      expect(screen.getByTestId('guide-link-license').getAttribute('href')).toContain('/blob/main/LICENSE');
      expect(screen.getByText('Video walkthrough not available yet')).toBeTruthy();

      // 5 Numbered Steps; only step 1 is open
      expect(screen.getByText('Test Signoff, step by step.')).toBeTruthy();
      expect(screen.getByTestId('guide-step-1')).toHaveProperty('open', true);
      expect(screen.getByTestId('guide-step-2')).toHaveProperty('open', false);
      expect(screen.getByText('Choose an available sandbox case.')).toBeTruthy();
      expect(screen.getByTestId('guide-step-1-link').textContent).toBe('Open demo disputes →');
      expect(screen.getByTestId('guide-step-1')).toBeTruthy();
      expect(screen.getByTestId('guide-step-1-link')).toBeTruthy();
      expect(screen.getByTestId('guide-step-2')).toBeTruthy();
      expect(screen.getByTestId('guide-step-3')).toBeTruthy();
      expect(screen.getByTestId('guide-step-3-link')).toBeTruthy();
      expect(screen.getByTestId('guide-step-4')).toBeTruthy();
      expect(screen.getByTestId('guide-step-4-disputes-link')).toBeTruthy();
      expect(screen.getByTestId('guide-step-4-demo-link')).toBeTruthy();
      expect(screen.getByTestId('guide-step-5')).toBeTruthy();

      // Real vs Simulated Table
      const table = screen.getByTestId('real-simulated-table');
      expect(table).toBeTruthy();
      expect(screen.getByText('PayPal Disputes API')).toBeTruthy();
      expect(screen.getByText('Policy Gate Engine')).toBeTruthy();
      expect(screen.getByText('100% pure deterministic Python rule engine (zero network/IO)')).toBeTruthy();
    });
  });
});
