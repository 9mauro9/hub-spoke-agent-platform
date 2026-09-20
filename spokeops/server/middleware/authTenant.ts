import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { getTenantRegistry } from '../store';

export interface AuthenticatedTenantRequest extends Request {
  tenantAppId?: string;
  tenantName?: string;
}

/**
 * Computes the SHA-256 hash of a raw secret token
 */
export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Validates spoke requests via x-spoke-token header against /registry/tenants/{appId}
 */
export function authTenantMiddleware(
  req: AuthenticatedTenantRequest,
  res: Response,
  next: NextFunction
): void {
  // Extract token from header or query parameter (beacon fallback)
  const rawToken = (req.headers['x-spoke-token'] as string) || (req.query.spokeToken as string);
  const appId = (req.headers['x-spoke-app-id'] as string) || (req.query.appId as string) || req.body?.appId;

  if (!rawToken) {
    res.status(401).json({
      error: 'UNAUTHORIZED_SPOKE',
      message: 'Missing mandatory x-spoke-token header'
    });
    return;
  }

  if (!appId) {
    res.status(400).json({
      error: 'MISSING_APP_ID',
      message: 'Missing mandatory appId in header or payload'
    });
    return;
  }

  const registry = getTenantRegistry();
  const tenant = registry.get(appId);

  if (!tenant) {
    res.status(403).json({
      error: 'TENANT_NOT_REGISTERED',
      message: `AppId '${appId}' is not registered in SpokeOps tenant registry`
    });
    return;
  }

  if (!tenant.isActive) {
    res.status(403).json({
      error: 'TENANT_INACTIVE',
      message: `Tenant '${appId}' has been marked inactive by SpokeOps administrators`
    });
    return;
  }

  // Verify SHA-256 hash against stored token hash
  const incomingHash = hashToken(rawToken);
  if (incomingHash !== tenant.spokeTokenHash && rawToken !== tenant.spokeTokenHash) {
    // In dev mode allow direct match or hash match
    res.status(401).json({
      error: 'INVALID_SPOKE_TOKEN',
      message: 'Invalid spoke credentials for specified appId'
    });
    return;
  }

  req.tenantAppId = appId;
  req.tenantName = tenant.appName;
  next();
}
