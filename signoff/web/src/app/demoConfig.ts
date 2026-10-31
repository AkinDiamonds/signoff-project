// A fixture capability for isolated tests and explicitly selected local mocks.
// It is not an owner credential and is never a production fallback.
export const MOCK_DEMO_CLAIM_TOKEN = 'fixture-demo-token';

export const demoClaimToken = import.meta.env.MODE === 'test' || import.meta.env.VITE_MOCK_API === 'true'
  ? MOCK_DEMO_CLAIM_TOKEN
  : import.meta.env.VITE_DEMO_CLAIM_TOKEN ?? '';
