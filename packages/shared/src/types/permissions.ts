/**
 * Application role enumeration
 */
export enum AppRole {
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
}

/**
 * Permission check result interface
 */
export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
}
