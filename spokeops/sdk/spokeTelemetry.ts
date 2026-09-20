/**
 * @spokeops/telemetry - Client Telemetry & RBAC Observability SDK (AES v3 Standard)
 * 
 * Zero-dependency TypeScript telemetry SDK for Spoke applications (Academy Apps, Avventiq, Hub-Spoke Agent Platform).
 * Provides dual-cadence heartbeats, unblocking unload beacons, and client-side OWASP credential sanitization.
 * 
 * @example
 * ```typescript
 * import { initSpokeOps, logAuditEvent, terminateSession } from '@spokeops/telemetry';
 * 
 * // 1. Initialize telemetry upon app bootstrap
 * initSpokeOps({
 *   appId: 'academy-library',
 *   spokeToken: 'spk_live_acadlib_99f2b84',
 *   endpointUrl: 'https://spokeops-ingestion-541312712358.us-central1.run.app/api/v1/telemetry',
 *   user: {
 *     userId: 'usr_inst_4482',
 *     email: 'sarah.connor@academy.edu',
 *     roles: ['instructor', 'curriculum_lead']
 *   },
 *   environment: 'production'
 * });
 * 
 * // 2. Log an audit event during user interactions
 * logAuditEvent({
 *   action: 'resource_update',
 *   resourceType: 'curriculum_module',
 *   resourceId: 'mod_quantum_101',
 *   status: 'success',
 *   metadata: { title: 'Updated quantum mechanics syllabus', revision: 3 }
 * });
 * ```
 */

export type SpokeOpsEnvironment = 'production' | 'staging' | 'development';

export interface SpokeUser {
  userId: string;
  email: string;
  roles: string[];
}

export interface ClientMetadata {
  userAgent: string;
  browser: string;
  os: string;
  ipAddress?: string;
  viewport: string;
}

export interface InitSpokeOpsConfig {
  appId: string;
  spokeToken: string;
  endpointUrl: string;
  user: SpokeUser;
  environment?: SpokeOpsEnvironment;
  activeHeartbeatMs?: number; // default: 120,000ms (2 minutes)
  idleHeartbeatMs?: number;   // default: 300,000ms (5 minutes)
}

export type AuditAction =
  | 'login'
  | 'logout'
  | 'role_grant'
  | 'role_revoke'
  | 'resource_create'
  | 'resource_update'
  | 'resource_delete'
  | 'permission_denied';

export type AuditStatus = 'success' | 'warning' | 'denied';

export interface LogAuditEventParams {
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  status: AuditStatus;
  roleAtExecution?: string;
  metadata?: Record<string, any>;
}

export interface TelemetryPayload {
  type: 'session_start' | 'heartbeat' | 'session_end' | 'audit_event';
  timestamp: string;
  appId: string;
  sessionId: string;
  userId: string;
  userEmail: string;
  userRoles: string[];
  clientMetadata: ClientMetadata;
  durationSeconds?: number;
  auditEvent?: {
    eventId: string;
    action: AuditAction;
    resourceType: string;
    resourceId: string;
    status: AuditStatus;
    roleAtExecution: string;
    metadata: Record<string, any>;
    timestamp: string;
  };
}

// Internal State Singleton
class SpokeOpsClient {
  private static instance: SpokeOpsClient | null = null;

  private config: InitSpokeOpsConfig | null = null;
  private sessionId: string = '';
  private sessionStartTime: number = Date.now();
  private lastHeartbeatTime: number = Date.now();
  private heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
  private isIdle: boolean = false;
  private isInitialized: boolean = false;

  private readonly ACTIVE_INTERVAL = 2 * 60 * 1000; // 2 minutes
  private readonly IDLE_INTERVAL = 5 * 60 * 1000;   // 5 minutes

  private constructor() {}

  public static getInstance(): SpokeOpsClient {
    if (!SpokeOpsClient.instance) {
      SpokeOpsClient.instance = new SpokeOpsClient();
    }
    return SpokeOpsClient.instance;
  }

  public init(config: InitSpokeOpsConfig): void {
    if (this.isInitialized) {
      // Update user info if re-initialized (e.g. after auth change)
      this.config = config;
      return;
    }

    this.config = config;
    this.sessionId = this.generateUUID();
    this.sessionStartTime = Date.now();
    this.lastHeartbeatTime = Date.now();
    this.isInitialized = true;

    // Send initial session payload
    this.sendPayload({
      type: 'session_start',
      timestamp: new Date().toISOString(),
      appId: config.appId,
      sessionId: this.sessionId,
      userId: config.user.userId,
      userEmail: config.user.email,
      userRoles: config.user.roles,
      clientMetadata: this.detectClientMetadata(),
      durationSeconds: 0
    });

    // Setup lifecycle listeners
    this.setupCadenceListeners();
    this.setupUnloadBeacon();
    this.scheduleNextHeartbeat();
  }

  public logEvent(params: LogAuditEventParams): void {
    if (!this.isInitialized || !this.config) {
      console.warn('[SpokeOps] SDK not initialized before logAuditEvent call.');
      return;
    }

    const sanitizedMetadata = this.sanitizeMetadata(params.metadata || {});
    const primaryRole = params.roleAtExecution || (this.config.user.roles[0] ?? 'anonymous');
    const eventId = `evt_${this.generateUUID()}`;

    const payload: TelemetryPayload = {
      type: 'audit_event',
      timestamp: new Date().toISOString(),
      appId: this.config.appId,
      sessionId: this.sessionId,
      userId: this.config.user.userId,
      userEmail: this.config.user.email,
      userRoles: this.config.user.roles,
      clientMetadata: this.detectClientMetadata(),
      durationSeconds: Math.floor((Date.now() - this.sessionStartTime) / 1000),
      auditEvent: {
        eventId,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        status: params.status,
        roleAtExecution: primaryRole,
        metadata: sanitizedMetadata,
        timestamp: new Date().toISOString()
      }
    };

    this.sendPayload(payload);
  }

  public terminate(): void {
    if (!this.isInitialized || !this.config) return;

    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    const payload: TelemetryPayload = {
      type: 'session_end',
      timestamp: new Date().toISOString(),
      appId: this.config.appId,
      sessionId: this.sessionId,
      userId: this.config.user.userId,
      userEmail: this.config.user.email,
      userRoles: this.config.user.roles,
      clientMetadata: this.detectClientMetadata(),
      durationSeconds: Math.floor((Date.now() - this.sessionStartTime) / 1000)
    };

    this.sendBeaconUnload(payload);
    this.isInitialized = false;
  }

  public getSessionId(): string {
    return this.sessionId;
  }

  private scheduleNextHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
    }

    const interval = this.isIdle
      ? (this.config?.idleHeartbeatMs || this.IDLE_INTERVAL)
      : (this.config?.activeHeartbeatMs || this.ACTIVE_INTERVAL);

    this.heartbeatTimer = setTimeout(() => {
      this.sendHeartbeat();
      this.scheduleNextHeartbeat();
    }, interval);
  }

  private sendHeartbeat(): void {
    if (!this.isInitialized || !this.config) return;

    this.lastHeartbeatTime = Date.now();
    const durationSeconds = Math.floor((Date.now() - this.sessionStartTime) / 1000);

    const payload: TelemetryPayload = {
      type: 'heartbeat',
      timestamp: new Date().toISOString(),
      appId: this.config.appId,
      sessionId: this.sessionId,
      userId: this.config.user.userId,
      userEmail: this.config.user.email,
      userRoles: this.config.user.roles,
      clientMetadata: this.detectClientMetadata(),
      durationSeconds
    };

    this.sendPayload(payload);
  }

  private setupCadenceListeners(): void {
    if (typeof document === 'undefined') return;

    const updateVisibility = () => {
      const wasIdle = this.isIdle;
      this.isIdle = document.visibilityState === 'hidden';

      if (wasIdle && !this.isIdle) {
        // Returned to active state, immediately pulse a heartbeat and switch to 2min cadence
        this.sendHeartbeat();
        this.scheduleNextHeartbeat();
      } else if (!wasIdle && this.isIdle) {
        // Hidden / minimized, transition to 5min idle cadence
        this.scheduleNextHeartbeat();
      }
    };

    document.addEventListener('visibilitychange', updateVisibility);

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => {
        if (this.isIdle) {
          this.isIdle = false;
          this.sendHeartbeat();
          this.scheduleNextHeartbeat();
        }
      });

      window.addEventListener('blur', () => {
        // If document is also not visible or unfocused
        if (document.hidden) {
          this.isIdle = true;
          this.scheduleNextHeartbeat();
        }
      });
    }
  }

  private setupUnloadBeacon(): void {
    if (typeof window === 'undefined') return;

    const unloadHandler = () => {
      this.terminate();
    };

    // Use pagehide for modern mobile & desktop browser reliability, fallback to beforeunload
    window.addEventListener('pagehide', unloadHandler);
    window.addEventListener('beforeunload', unloadHandler);
  }

  private sendPayload(payload: TelemetryPayload): void {
    if (!this.config) return;

    const serialized = JSON.stringify(payload);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-spoke-token': this.config.spokeToken,
      'x-spoke-app-id': this.config.appId
    };

    if (typeof fetch !== 'undefined') {
      fetch(this.config.endpointUrl, {
        method: 'POST',
        headers,
        body: serialized,
        keepalive: true
      }).catch((err) => {
        // Non-blocking catch to prevent application disruption
        if (process.env.NODE_ENV === 'development') {
          console.debug('[SpokeOps] Telemetry sync notice:', err.message);
        }
      });
    }
  }

  private sendBeaconUnload(payload: TelemetryPayload): void {
    if (!this.config) return;

    const serialized = JSON.stringify(payload);

    // Try navigator.sendBeacon first if available and standard endpoint allows blob/json
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([serialized], { type: 'application/json' });
      // sendBeacon doesn't allow custom headers directly in standard API, so we include credentials query param or fallback to keepalive fetch
      const beaconUrl = `${this.config.endpointUrl}?spokeToken=${encodeURIComponent(this.config.spokeToken)}&appId=${encodeURIComponent(this.config.appId)}`;
      const queued = navigator.sendBeacon(beaconUrl, blob);
      if (queued) return;
    }

    // Fallback to fetch with keepalive: true
    if (typeof fetch !== 'undefined') {
      fetch(this.config.endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-spoke-token': this.config.spokeToken,
          'x-spoke-app-id': this.config.appId
        },
        body: serialized,
        keepalive: true
      }).catch(() => {});
    }
  }

  /**
   * Client-side OWASP sanitization helper to scrub sensitive fields before transmission
   */
  private sanitizeMetadata(data: Record<string, any>): Record<string, any> {
    const sensitivePatterns = [
      /password/i,
      /token/i,
      /secret/i,
      /authorization/i,
      /bearer/i,
      /apikey/i,
      /api_key/i,
      /credit_?card/i,
      /cvv/i,
      /ssn/i,
      /private_?key/i
    ];

    const sanitizeObject = (obj: any): any => {
      if (!obj || typeof obj !== 'object') return obj;

      if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      }

      const clean: Record<string, any> = {};
      for (const [key, value] of Object.entries(obj)) {
        const isSensitive = sensitivePatterns.some((pattern) => pattern.test(key));
        if (isSensitive) {
          clean[key] = '[REDACTED_BY_SDK]';
        } else if (typeof value === 'object' && value !== null) {
          clean[key] = sanitizeObject(value);
        } else {
          clean[key] = value;
        }
      }
      return clean;
    };

    return sanitizeObject(data);
  }

  private detectClientMetadata(): ClientMetadata {
    if (typeof window === 'undefined') {
      return {
        userAgent: 'Server-Side Node',
        browser: 'Node.js',
        os: 'Server',
        viewport: '0x0'
      };
    }

    const ua = navigator.userAgent || '';
    let browser = 'Unknown Browser';
    let os = 'Unknown OS';

    // Basic browser heuristics
    if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Edg/')) browser = 'Microsoft Edge';
    else if (ua.includes('Chrome')) browser = 'Google Chrome';
    else if (ua.includes('Safari')) browser = 'Safari';

    // Basic OS heuristics
    if (ua.includes('Mac OS')) os = 'macOS';
    else if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

    const viewport = `${window.innerWidth || 0}x${window.innerHeight || 0}`;

    return {
      userAgent: ua,
      browser,
      os,
      viewport
    };
  }

  private generateUUID(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback RFC4122 v4 generator
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

// Exported public SDK methods
export const initSpokeOps = (config: InitSpokeOpsConfig): void => {
  SpokeOpsClient.getInstance().init(config);
};

export const logAuditEvent = (params: LogAuditEventParams): void => {
  SpokeOpsClient.getInstance().logEvent(params);
};

export const terminateSession = (): void => {
  SpokeOpsClient.getInstance().terminate();
};

export const getSessionId = (): string => {
  return SpokeOpsClient.getInstance().getSessionId();
};
