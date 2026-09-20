export type UserPersona = 'helpdesk_viewer' | 'ops_admin';

export type TenantEnvironment = 'production' | 'staging' | 'development';

export interface TenantRegistryDoc {
  appId: string;              // e.g. "academy-library", "academy-timeliner", "avventiq"
  appName: string;            // e.g. "Academy Timeliner"
  environment: TenantEnvironment;
  allowedOrigins: string[];
  spokeTokenHash: string;     // SHA-256 hashed secret token for SDK auth
  isActive: boolean;
  createdAt: string;
}

export type SessionStatus = 'active' | 'idle' | 'closed' | 'timed_out';

export interface ClientMetadata {
  userAgent: string;
  browser: string;
  os: string;
  ipAddress: string;        // Must be masked for Help Desk persona
  viewport: string;
}

export interface SessionDoc {
  sessionId: string;          // Generated UUIDv4 or client session token
  appId: string;
  userId: string;
  userEmail: string;
  userRoles: string[];        // Array of RBAC roles e.g. ["instructor", "curriculum_lead"]
  startedAt: string;
  lastHeartbeat: string;
  durationSeconds: number;
  status: SessionStatus;
  clientMetadata: ClientMetadata;
}

export type AuditAction =
  | 'login'
  | 'logout'
  | 'agent_task_started'
  | 'agent_task_executed'
  | 'agent_task_failed'
  | 'role_grant'
  | 'role_revoke'
  | 'policy_update'
  | 'resource_create'
  | 'resource_update'
  | 'resource_delete'
  | 'permission_denied';

export type AuditSeverity = 'success' | 'warning' | 'denied';

export interface AuditEventDoc {
  eventId: string;
  appId: string;
  sessionId: string;
  userId: string;
  userEmail: string;
  roleAtExecution: string;
  action: AuditAction;
  resourceType: string;       // e.g. "curriculum_module", "event_schedule", "tenant_user"
  resourceId: string;
  status: AuditSeverity;
  metadata: Record<string, any>; // OWASP PII-sanitized arbitrary payload
  timestamp: string;
}

export type DateRangeOption = '15m' | '1h' | '24h' | '7d' | 'custom';
