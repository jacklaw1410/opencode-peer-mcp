import { describe, expect, it } from 'vitest';
import { evaluateWriteGate } from '../src/writeGate.js';

describe('evaluateWriteGate', () => {
  it('allows when enabled and allowlisted', () => {
    expect(
      evaluateWriteGate({
        globalEnabled: true,
        allowlisted: true,
        explicitAllow: false,
      }),
    ).toEqual({
      allowed: true,
      decision: 'allowed',
    });
  });

  it('denies when disabled', () => {
    expect(
      evaluateWriteGate({
        globalEnabled: false,
        allowlisted: true,
        explicitAllow: true,
      }),
    ).toEqual({
      allowed: false,
      decision: 'denied: writes disabled',
    });
  });

  it('denies when not allowlisted', () => {
    expect(
      evaluateWriteGate({
        globalEnabled: true,
        allowlisted: false,
        explicitAllow: false,
      }),
    ).toEqual({
      allowed: false,
      decision: 'denied: session not allowlisted',
    });
  });
});
