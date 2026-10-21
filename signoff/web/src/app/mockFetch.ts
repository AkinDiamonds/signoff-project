import { disputesFixture, kpisFixture, statusFixture } from '../../../fixtures/ui';

const FIXTURES: Record<string, unknown> = {
  '/api/status': statusFixture,
  '/api/kpis': kpisFixture,
  '/api/disputes': disputesFixture,
};

const MOCK_ORIGIN = 'http://mock.invalid';

export const mockFetch: typeof fetch = async (input, init) => {
  const raw =
    typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const { pathname } = new URL(raw, MOCK_ORIGIN);
  const method = init?.method ?? 'GET';
  const fixture = FIXTURES[pathname];

  if (method !== 'GET' || fixture === undefined) {
    return new Response(
      JSON.stringify({
        error: {
          code: 'NOT_FOUND',
          message: 'No mock fixture exists for this request.',
          correlation_id: 'mock-not-found',
          fields: [],
        },
      }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(JSON.stringify(fixture), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
