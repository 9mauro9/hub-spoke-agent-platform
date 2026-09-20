/**
 * SpokeOps Client Telemetry & Audit Hook (AES v3 Standard)
 * 
 * Provides asynchronous, non-blocking telemetry streaming to SpokeOps:
 * - Session heartbeat & presence tracking (2min active / 5min idle dynamic cadence)
 * - Beforeunload / pagehide session closing via sendBeacon or keepalive fetch
 * - Client-side OWASP credential sanitization
 * - Structured audit events for agent tasks, tool dispatches, and RBAC actions
 */

export interface SpokeUser {
  uid: string;
  email: string;
  roles: string[];
}

export interface AuditEventPayload {
  action:
    | "login"
    | "logout"
    | "agent_task_started"
    | "agent_task_executed"
    | "agent_task_failed"
    | "role_grant"
    | "policy_update"
    | "permission_denied";
  resourceType: string; // e.g., "agent_workflow", "tool_call", "tenant_policy", "control_plane_route"
  resourceId: string;
  status: "success" | "warning" | "denied";
  metadata?: Record<string, any>;
}

export class SpokeOpsTelemetry {
  private appId =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_SPOKEOPS_APP_ID) ||
    "hub-spoke-agent-platform";
  private endpoint =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_SPOKEOPS_ENDPOINT) ||
    "https://spokeops-ingestion-541312712358.us-central1.run.app/api/v1/telemetry";
  private token =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_SPOKEOPS_TOKEN) ||
    "spk_live_hubspoke_b82f109";
  private sessionId: string | null = null;
  private currentUser: SpokeUser | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private isActiveCadence = true;
  private listenersAttached = false;

  public init(user: SpokeUser) {
    if (!this.endpoint || !this.token) {
      console.warn("[SpokeOps] Telemetry disabled: missing endpoint or spoke token.");
      return;
    }

    this.currentUser = user;

    // Preserve existing session ID if already initialized with user, or generate new
    if (!this.sessionId) {
      this.sessionId = `sess_${Math.random().toString(36).substring(2, 11)}_${Date.now()}`;
    }

    // Emit initial session creation ping
    this.sendSessionPing("active");

    // Establish dynamic heartbeat cadence: 2 minutes active cadence
    this.startHeartbeat(120000);

    if (!this.listenersAttached && typeof document !== "undefined" && typeof window !== "undefined") {
      this.listenersAttached = true;

      // Handle tab visibility changes (AES v3 idle cadence shift)
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
          this.isActiveCadence = false;
          this.startHeartbeat(300000); // 5 minutes idle cadence
        } else {
          this.isActiveCadence = true;
          this.startHeartbeat(120000); // 2 minutes active cadence
          this.sendSessionPing("active");
        }
      });

      // Capture tab closure or navigation
      const unloadHandler = () => {
        this.closeSession();
      };

      window.addEventListener("pagehide", unloadHandler);
      window.addEventListener("beforeunload", unloadHandler);
    }
  }

  public getSessionId(): string | null {
    return this.sessionId;
  }

  public getCurrentUser(): SpokeUser | null {
    return this.currentUser;
  }

  public getAppId(): string {
    return this.appId;
  }

  private startHeartbeat(intervalMs: number) {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      this.sendSessionPing(this.isActiveCadence ? "active" : "idle");
    }, intervalMs);
  }

  private sendSessionPing(status: "active" | "idle") {
    if (!this.sessionId || !this.currentUser) return;

    const payload = {
      type: "session_heartbeat",
      appId: this.appId,
      sessionId: this.sessionId,
      userId: this.currentUser.uid,
      userEmail: this.currentUser.email,
      userRoles: this.currentUser.roles,
      status,
      clientMetadata: {
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "Node/Browser",
        viewport: typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : "1920x1080",
        path: typeof window !== "undefined" ? window.location.pathname : "/"
      }
    };

    this.postPayload(payload);
  }

  public logAudit(event: AuditEventPayload) {
    if (!this.sessionId || !this.currentUser) return;

    const payload = {
      type: "audit_event",
      appId: this.appId,
      sessionId: this.sessionId,
      userId: this.currentUser.uid,
      userEmail: this.currentUser.email,
      roleAtExecution: this.currentUser.roles[0] || "operator",
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      status: event.status,
      metadata: this.sanitizeMetadata(event.metadata || {}),
      timestamp: new Date().toISOString()
    };

    this.postPayload(payload);
  }

  public closeSession() {
    if (!this.sessionId || !this.currentUser) return;

    const payload = JSON.stringify({
      type: "session_heartbeat",
      appId: this.appId,
      sessionId: this.sessionId,
      userId: this.currentUser.uid,
      userEmail: this.currentUser.email,
      userRoles: this.currentUser.roles,
      status: "closed"
    });

    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      const beaconUrl = `${this.endpoint}?spokeToken=${encodeURIComponent(this.token)}&appId=${encodeURIComponent(this.appId)}`;
      navigator.sendBeacon(beaconUrl, blob);
    } else if (typeof fetch !== "undefined") {
      fetch(this.endpoint, {
        method: "POST",
        body: payload,
        headers: {
          "Content-Type": "application/json",
          "x-spoke-token": this.token,
          "x-spoke-app-id": this.appId
        },
        keepalive: true
      }).catch(() => {});
    }

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private postPayload(data: any) {
    if (typeof fetch === "undefined" || !this.endpoint) return;

    fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-spoke-token": this.token,
        "x-spoke-app-id": this.appId
      },
      body: JSON.stringify(data)
    }).catch((err) => {
      console.warn("[SpokeOps] Telemetry dispatch failed non-blockingly:", err);
    });
  }

  private sanitizeMetadata(meta: Record<string, any>): Record<string, any> {
    const redacted = { ...meta };
    const sensitiveKeys = ["token", "password", "apikey", "secret", "auth", "credential", "privatekey", "bearer"];
    for (const key of Object.keys(redacted)) {
      const lower = key.toLowerCase();
      if (sensitiveKeys.some((s) => lower.includes(s.toLowerCase()))) {
        redacted[key] = "[REDACTED]";
      }
    }
    return redacted;
  }
}

export const spokeOps = new SpokeOpsTelemetry();
