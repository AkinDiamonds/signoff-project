// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
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
      <MemoryRouter>{ui}</MemoryRouter>
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
      expect(screen.getByTestId('view-switcher-merchant-tab').getAttribute('aria-selected')).toBe('true');
      expect(screen.getByTestId('view-switcher-buyer-tab').getAttribute('aria-selected')).toBe('false');

      // Merchant links present
      expect(screen.getByTestId('view-link-merchant-dashboard')).toBeTruthy();
      expect(screen.getByTestId('view-link-merchant-disputes')).toBeTruthy();
      expect(screen.getByTestId('view-link-merchant-charter')).toBeTruthy();
      expect(screen.getByTestId('view-link-merchant-demo')).toBeTruthy();

      // Click Buyer View
      fireEvent.click(screen.getByTestId('view-switcher-buyer-tab'));
      expect(onViewChange).toHaveBeenCalledWith('buyer');
      expect(screen.getByTestId('view-switcher-buyer-tab').getAttribute('aria-selected')).toBe('true');

      // Buyer links present
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
      expect(screen.getByRole('heading', { level: 1, name: /AI-Driven Dispute Defense/i })).toBeTruthy();
      const guideCta = screen.getByTestId('landing-cta-guide');
      expect(guideCta.getAttribute('href')).toBe('/guide');
      expect(screen.getByTestId('landing-cta-dashboard').getAttribute('href')).toBe('/app');

      // Try it in 3 minutes
      expect(screen.getByRole('heading', { name: /Try it in 3 minutes/i })).toBeTruthy();
      expect(screen.getByTestId('landing-cta-pool').getAttribute('href')).toBe('/app/pool');

      // Problem section
      expect(screen.getByRole('heading', { name: /The Problem:/i })).toBeTruthy();
      expect(screen.getByText(/Strict 10-20 Day Deadlines/i)).toBeTruthy();
      expect(screen.getByText(/The Hallucination Danger/i)).toBeTruthy();

      // Signing limit idea
      expect(screen.getByRole('heading', { name: /The Solution: The Authority Charter/i })).toBeTruthy();
      expect(screen.getByText(/AI Proposes Only/i)).toBeTruthy();
      expect(screen.getByText(/Pure Deterministic Gate/i)).toBeTruthy();
      expect(screen.getByText(/1-Tap Mobile Signoff/i)).toBeTruthy();

      // Pipeline
      expect(screen.getByRole('heading', { name: /How It Works:/i })).toBeTruthy();
      expect(screen.getByText('Webhook Sync')).toBeTruthy();
      expect(screen.getByText('Evidence Assembly')).toBeTruthy();
      expect(screen.getByText('Policy Gate')).toBeTruthy();
      expect(screen.getByText('Merchant Signoff')).toBeTruthy();
      expect(screen.getByText('Write-Ahead Dispatch')).toBeTruthy();

      // Claims
      expect(screen.getByRole('heading', { name: /Public Claims & Proof Ledger/i })).toBeTruthy();
      expect(screen.getByTestId('claim-card-CLAIM-AI-NO-MUTATING')).toBeTruthy();
      expect(screen.getByTestId('claim-card-CLAIM-GATE-FAIL-CLOSED')).toBeTruthy();

      // Embedded System Status
      expect(screen.getByTestId('home-status-card')).toBeTruthy();
    });
  });

  describe('GuidePage', () => {
    it('renders 5-step numbered path, credentials, comparison table, and resource links', () => {
      renderWithProviders(<GuidePage />);

      // Header and resource links
      expect(screen.getByRole('heading', { level: 1, name: /5-Minute Judge Guide/i })).toBeTruthy();
      expect(screen.getByTestId('guide-link-repo').getAttribute('href')).toContain('github.com');
      expect(screen.getByTestId('guide-link-license').getAttribute('href')).toBe('/LICENSE');
      expect(screen.getByTestId('guide-link-video').getAttribute('href')).toContain('youtube.com');

      // 5 Numbered Steps
      expect(screen.getByTestId('guide-step-1')).toBeTruthy();
      expect(screen.getByTestId('guide-step-1-link')).toBeTruthy();
      expect(screen.getByTestId('guide-step-2')).toBeTruthy();
      expect(screen.getByTestId('guide-step-3')).toBeTruthy();
      expect(screen.getByTestId('guide-step-3-link')).toBeTruthy();
      expect(screen.getByTestId('guide-step-4')).toBeTruthy();
      expect(screen.getByTestId('guide-step-4-disputes-link')).toBeTruthy();
      expect(screen.getByTestId('guide-step-4-demo-link')).toBeTruthy();
      expect(screen.getByTestId('guide-step-5')).toBeTruthy();

      // Test credentials
      expect(screen.getByTestId('guide-credentials-card')).toBeTruthy();
      expect(screen.getByTestId('guide-buyer-email').textContent).toBe('alex.morgan@example.test');
      expect(screen.getByTestId('guide-merchant-id').textContent).toBe('sb-merchant@example.test');

      // Real vs Simulated Table
      const table = screen.getByTestId('real-simulated-table');
      expect(table).toBeTruthy();
      expect(screen.getByText('PayPal Disputes API')).toBeTruthy();
      expect(screen.getByText('Policy Gate Engine')).toBeTruthy();
      expect(screen.getByText('100% pure deterministic Python rule engine (zero network/IO)')).toBeTruthy();
    });
  });
});
