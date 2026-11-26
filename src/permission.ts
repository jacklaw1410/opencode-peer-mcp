export interface PermissionInput {
  globalEnabled: boolean;
  allowlisted: boolean;
  explicitAllow: boolean;
}

export interface PermissionResult {
  allowed: boolean;
  decision: string;
}

export function evaluatePermission(input: PermissionInput): PermissionResult {
  if (!input.globalEnabled) {
    return { allowed: false, decision: 'writes disabled' };
  }
  if (input.allowlisted || input.explicitAllow) {
    return { allowed: true, decision: 'allowed' };
  }
  return { allowed: false, decision: 'session not allowlisted' };
}
