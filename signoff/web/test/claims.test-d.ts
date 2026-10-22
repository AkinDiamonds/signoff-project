import { describe, expectTypeOf, it } from 'vitest';
import type { ClaimId, ClaimStatus, PublicClaim } from '../src/features/site/claims';
import { PUBLIC_CLAIMS } from '../src/features/site/claims';

describe('Public Claims Type Contracts', () => {
  it('PUBLIC_CLAIMS is a readonly array of PublicClaim with literal ClaimIds', () => {
    expectTypeOf(PUBLIC_CLAIMS).toMatchTypeOf<readonly PublicClaim[]>();

    // Assert literal ClaimId union check
    const validId: ClaimId = 'CLAIM-AI-NO-MUTATING';
    expectTypeOf(validId).toEqualTypeOf<ClaimId>();

    // @ts-expect-error - Arbitrary string is rejected as ClaimId
    const _invalidId: ClaimId = 'NON_EXISTENT_CLAIM';

    const claim = PUBLIC_CLAIMS[0];
    if (claim) {
      expectTypeOf(claim.id).toMatchTypeOf<ClaimId>();
      expectTypeOf(claim.status).toMatchTypeOf<ClaimStatus>();
      expectTypeOf(claim.statement).toEqualTypeOf<string>();
      expectTypeOf(claim.proof).toEqualTypeOf<string>();
    }
  });
});
