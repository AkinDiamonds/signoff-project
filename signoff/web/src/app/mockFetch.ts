import {
  approvalCardFixture,
  disputeDetailFixture,
  disputeDetailNeedsApprovalFixture,
  disputesFixture,
  disputeTimelineFixture,
  kpisFixture,
  statusFixture,
} from '../../../fixtures/ui';

const STATIC_FIXTURES: Record<string, unknown> = {
  '/api/status': statusFixture,
  '/api/kpis': kpisFixture,
  '/api/disputes': disputesFixture,
};

const MOCK_ORIGIN = 'http://mock.invalid';

const resolvedTokens = new Map<string, { resolution: 'APPROVE' | 'DENY' | 'EDIT'; resolved_at: string }>();

export function resetMockResolvedTokens(): void {
  resolvedTokens.clear();
}

export const mockFetch: typeof fetch = async (input, init) => {
  const raw =
    typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const { pathname } = new URL(raw, MOCK_ORIGIN);
  const method = init?.method ?? 'GET';

  if (method === 'GET') {
    if (STATIC_FIXTURES[pathname] !== undefined) {
      return new Response(JSON.stringify(STATIC_FIXTURES[pathname]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Match /api/disputes/{id}/timeline
    const timelineMatch = pathname.match(/^\/api\/disputes\/([^/]+)\/timeline$/);
    if (timelineMatch) {
      const id = timelineMatch[1];
      if (id === 'not-found' || id === 'does-not-exist') {
        return new Response(
          JSON.stringify({
            error: {
              code: 'NOT_FOUND',
              message: `Dispute '${id}' not found.`,
              correlation_id: 'mock-not-found',
              fields: [],
            },
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify(disputeTimelineFixture), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Match /api/disputes/{id}
    const disputeMatch = pathname.match(/^\/api\/disputes\/([^/]+)$/);
    if (disputeMatch) {
      const id = disputeMatch[1];
      if (id === 'not-found' || id === 'does-not-exist') {
        return new Response(
          JSON.stringify({
            error: {
              code: 'NOT_FOUND',
              message: `Dispute '${id}' not found.`,
              correlation_id: 'mock-not-found',
              fields: [],
            },
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (id === 'PP-D-1002') {
        return new Response(JSON.stringify(disputeDetailNeedsApprovalFixture), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify(disputeDetailFixture), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Match /api/approvals/{token}
    const approvalMatch = pathname.match(/^\/api\/approvals\/([^/]+)$/);
    if (approvalMatch) {
      const token = approvalMatch[1];
      if (token === 'invalid-token' || token === 'not-found') {
        return new Response(
          JSON.stringify({
            error: {
              code: 'TOKEN_INVALID',
              message: 'Invalid approval link.',
              correlation_id: 'mock-invalid-token',
              fields: [],
            },
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (token === 'expired-token') {
        return new Response(
          JSON.stringify({
            ...approvalCardFixture,
            resolution: 'EXPIRED',
            expires_at: '2020-01-01T00:00:00Z',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (token === 'resolved-token') {
        return new Response(
          JSON.stringify({
            ...approvalCardFixture,
            resolution: 'APPROVE',
            resolved_at: '2026-10-21T09:00:00Z',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (resolvedTokens.has(token)) {
        const recorded = resolvedTokens.get(token)!;
        return new Response(
          JSON.stringify({
            ...approvalCardFixture,
            resolution: recorded.resolution,
            resolved_at: recorded.resolved_at,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify(approvalCardFixture), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  if (method === 'POST') {
    const resolveMatch = pathname.match(/^\/api\/approvals\/([^/]+)\/resolve$/);
    if (resolveMatch) {
      const token = resolveMatch[1];
      if (resolvedTokens.has(token)) {
        return new Response(
          JSON.stringify({
            error: {
              code: 'CONFLICT_STALE',
              message: 'Dispute state has changed or approval was already resolved.',
              correlation_id: 'mock-already-resolved',
              fields: [],
            },
          }),
          { status: 409, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (token === 'conflict-token') {
        return new Response(
          JSON.stringify({
            error: {
              code: 'CONFLICT_STALE',
              message: 'Dispute state has changed. Approval is stale.',
              correlation_id: 'mock-conflict',
              fields: [],
            },
          }),
          { status: 409, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (token === 'network-error-token') {
        throw new TypeError('Failed to fetch');
      }

      let action: 'APPROVE' | 'DENY' | 'EDIT' = 'APPROVE';
      try {
        if (init?.body && typeof init.body === 'string') {
          const parsed = JSON.parse(init.body);
          if (parsed.action === 'DENY' || parsed.action === 'EDIT' || parsed.action === 'APPROVE') {
            action = parsed.action;
          }
        }
      } catch {
        // ignore
      }

      const resolvedAt = new Date().toISOString();
      resolvedTokens.set(token, { resolution: action, resolved_at: resolvedAt });

      return new Response(
        JSON.stringify({
          success: true,
          resolution: action,
          resolved_at: resolvedAt,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

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
};
