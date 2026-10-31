import React from 'react';
import { retailTheme } from '../theme';

export const PayPalResolutionPanel: React.FC = () => (
  <section data-testid="paypal-resolution-guidance" style={{ padding: 24, background: '#fff', borderRadius: 12 }}>
    <h2 style={{ marginTop: 0, color: retailTheme.ink }}>Need help with a payment?</h2>
    <p style={{ color: retailTheme.inkMuted, lineHeight: 1.6 }}>
      Report a problem or manage an existing dispute in PayPal’s Resolution Center.
      Sign in with the PayPal sandbox buyer account you used at checkout and select your payment.
    </p>
    <a href="https://www.sandbox.paypal.com/disputes/" target="_blank" rel="noopener noreferrer"
      data-testid="paypal-resolution-link" style={{ color: '#0f766e', fontWeight: 650 }}>
      Open PayPal Resolution Center ↗
    </a>
    <p style={{ marginBottom: 0, fontSize: 13, color: retailTheme.inkMuted, lineHeight: 1.5 }}>
      Disputes are filed on PayPal. Signoff receives PayPal’s verified notifications so the merchant can respond.
      This shop uses sandbox payments and simulated shipping.
    </p>
  </section>
);
