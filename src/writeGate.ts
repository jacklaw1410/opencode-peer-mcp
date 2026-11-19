export interface WriteGateInput {
  globalEnabled: boolean;
  allowlisted: boolean;
  explicitAllow: boolean;
}

export interface WriteGateResult {
  allowed: boolean;
  decision: string;
}

export function evaluateWriteGate(input: WriteGateInput): WriteGateResult {
  if (!input.globalEnabled) {
    return { allowed: false, decision: 'denied: writes disabled' };
  }
  if (input.allowlisted || input.explicitAllow) {
    return { allowed: true, decision: 'allowed' };
  }
  return { allowed: false, decision: 'denied: session not allowlisted' };
}
