import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getClaim, PUBLIC_CLAIMS } from '../src/features/site/claims';

describe('Public Claims Ledger Contract', () => {
  const ledgerPath = path.resolve(__dirname, '../../docs/claims-ledger.md');

  it('claims-ledger.md exists and is readable', () => {
    expect(fs.existsSync(ledgerPath)).toBe(true);
  });

  it('every public claim has a matching row in docs/claims-ledger.md', () => {
    const content = fs.readFileSync(ledgerPath, 'utf-8');
    const lines = content.split('\n');

    // Parse table rows starting with | CLAIM-
    const ledgerIds = new Set<string>();
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('|') && !trimmed.startsWith('|---') && !trimmed.startsWith('| ID')) {
        const parts = trimmed.split('|').map((p) => p.trim());
        // parts[0] is empty, parts[1] is ID
        const id = parts[1];
        if (id && id.startsWith('CLAIM-')) {
          ledgerIds.add(id);
        }
      }
    }

    expect(ledgerIds.size).toBeGreaterThan(0);

    for (const claim of PUBLIC_CLAIMS) {
      expect(
        ledgerIds.has(claim.id),
        `Public claim '${claim.id}' has no matching row in docs/claims-ledger.md`
      ).toBe(true);
      expect(claim.statement.trim().length).toBeGreaterThan(10);
      expect(claim.proof.trim().length).toBeGreaterThan(5);
      expect(['Verified', 'Planned']).toContain(claim.status);
    }
  });

  it('getClaim throws on unknown id and returns matching claim on valid id', () => {
    const valid = getClaim('CLAIM-AI-NO-MUTATING');
    expect(valid.id).toBe('CLAIM-AI-NO-MUTATING');
    expect(valid.status).toBe('Verified');

    expect(() => getClaim('UNKNOWN-CLAIM')).toThrowError(/Unknown claim id/);
  });

  it('no duplicate claim IDs exist in PUBLIC_CLAIMS', () => {
    const ids = PUBLIC_CLAIMS.map((c) => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});
