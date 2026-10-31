/** Local stub fixtures must never bypass PayPal approval in a deployed build. */
export function isStubCheckoutEnabled(): boolean {
  return import.meta.env.DEV && import.meta.env.VITE_STUB_CHECKOUT === 'true';
}
