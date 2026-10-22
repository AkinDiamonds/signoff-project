import { describe, expect, it } from 'vitest';
import { parseAmountInput } from '../src/features/approval/amountParser';

describe('amountParser (table of at least 15 inputs)', () => {
  const testCases: Array<{
    input: string;
    expectedOk: boolean;
    expectedValue?: string;
    expectedError?: string;
    description: string;
  }> = [
    {
      input: '42',
      expectedOk: true,
      expectedValue: '42.00',
      description: '1. Integer string without decimal',
    },
    {
      input: '42.5',
      expectedOk: true,
      expectedValue: '42.50',
      description: '2. One decimal place normalized to two',
    },
    {
      input: '42.50',
      expectedOk: true,
      expectedValue: '42.50',
      description: '3. Standard two-decimal value',
    },
    {
      input: '$42.50',
      expectedOk: true,
      expectedValue: '42.50',
      description: '4. Leading dollar sign',
    },
    {
      input: '  42.50  ',
      expectedOk: true,
      expectedValue: '42.50',
      description: '5. Leading and trailing spaces',
    },
    {
      input: '1,234.56',
      expectedOk: true,
      expectedValue: '1234.56',
      description: '6. Comma thousands separator',
    },
    {
      input: '1 234.56',
      expectedOk: true,
      expectedValue: '1234.56',
      description: '7. Internal space separator',
    },
    {
      input: '007.50',
      expectedOk: true,
      expectedValue: '7.50',
      description: '8. Leading zeros normalized',
    },
    {
      input: '0.5',
      expectedOk: true,
      expectedValue: '0.50',
      description: '9. Zero point one decimal',
    },
    {
      input: '.50',
      expectedOk: true,
      expectedValue: '0.50',
      description: '10. Leading dot without zero',
    },
    {
      input: '$ 100',
      expectedOk: true,
      expectedValue: '100.00',
      description: '11. Dollar sign with space and integer',
    },
    {
      input: '$0.00',
      expectedOk: false,
      expectedError: 'Amount must be greater than zero',
      description: '12. Zero dollars and zero cents rejected',
    },
    {
      input: '',
      expectedOk: false,
      expectedError: 'Amount cannot be empty',
      description: '13. Empty string rejected',
    },
    {
      input: '   ',
      expectedOk: false,
      expectedError: 'Amount cannot be empty',
      description: '14. Whitespace only rejected',
    },
    {
      input: '-10.00',
      expectedOk: false,
      expectedError: 'Amount cannot be negative',
      description: '15. Negative amount rejected',
    },
    {
      input: '10.001',
      expectedOk: false,
      expectedError: 'Amount cannot have more than two decimal places',
      description: '16. Three decimal places rejected',
    },
    {
      input: 'abc',
      expectedOk: false,
      expectedError: 'Invalid amount format',
      description: '17. Non-numeric text rejected',
    },
    {
      input: '1,23,45',
      expectedOk: false,
      expectedError: 'Invalid comma format in amount',
      description: '18. Malformed comma grouping rejected',
    },
    {
      input: '12.34.56',
      expectedOk: false,
      expectedError: 'Amount cannot contain multiple decimal points',
      description: '19. Multiple decimal points rejected',
    },
    {
      input: '1000000.00',
      expectedOk: false,
      expectedError: 'Amount exceeds maximum permitted limit ($100,000.00)',
      description: '20. Huge value exceeding maximum rejected',
    },
  ];

  it('verifies table of 20 parser inputs across all edge cases', () => {
    expect(testCases.length).toBeGreaterThanOrEqual(15);

    for (const tc of testCases) {
      const res = parseAmountInput(tc.input);
      if (tc.expectedOk) {
        expect(res.ok, `Expected ok for: ${tc.description} ("${tc.input}")`).toBe(true);
        if (res.ok) {
          expect(res.money.value).toBe(tc.expectedValue);
          expect(res.money.currency_code).toBe('USD');
        }
      } else {
        expect(res.ok, `Expected error for: ${tc.description} ("${tc.input}")`).toBe(false);
        if (!res.ok) {
          expect(res.error).toBe(tc.expectedError);
        }
      }
    }
  });
});
