import { describe, expect, it } from 'vitest';
import { formatDisputeReason, getRuleExplanation } from '../src/mappings';

describe('Plain language mappings', () => {
  it('maps MERCHANDISE_OR_SERVICE_NOT_RECEIVED to Item not received', () => {
    expect(formatDisputeReason('MERCHANDISE_OR_SERVICE_NOT_RECEIVED')).toBe('Item not received');
  });

  it('maps UNAUTHORISED correctly', () => {
    expect(formatDisputeReason('UNAUTHORISED')).toBe('Unauthorised transaction');
  });

  it('handles null or empty fallback', () => {
    expect(formatDisputeReason(null)).toBe('Other');
    expect(formatDisputeReason('')).toBe('Other');
  });

  it('provides plain English rule explanations without exposing fingerprint', () => {
    expect(getRuleExplanation('G3-01')).toContain('Requires human approval');
    expect(getRuleExplanation('G6-01')).not.toContain('fingerprint');
    expect(getRuleExplanation('G6-01')).toContain('duplicate execution');
  });
});

