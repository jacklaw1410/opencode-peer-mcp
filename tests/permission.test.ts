import { describe, expect, it } from 'bun:test';
import { evaluatePermission } from '../src/permission.js';

describe('evaluatePermission', () => {
  it('allows when enabled and allowlisted', () => {
    expect(
      evaluatePermission({
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
      evaluatePermission({
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
      evaluatePermission({
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
