/**
 * Live API Data Service Layer for SpokeOps Operations Console (AES v3 Standard)
 * Communicates with Central Ingestion API (/api/v1) via Firebase Hosting rewrites or direct API base URL.
 */
import { TenantRegistryDoc, SessionDoc, AuditEventDoc } from '../types/telemetry';

export interface TelemetryService {
  getTenants(): Promise<TenantRegistryDoc[]>;
  getSessions(appId?: string): Promise<SessionDoc[]>;
  getAuditEvents(appId?: string): Promise<AuditEventDoc[]>;
  disconnectSession(sessionId: string): Promise<boolean>;
}

class LiveApiTelemetryService implements TelemetryService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) || '';
  }

  async getTenants(): Promise<TenantRegistryDoc[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/tenants`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.tenants || [];
    } catch (err) {
      console.error('[SpokeOps Service] Error fetching tenants:', err);
      return [];
    }
  }

  async getSessions(appId?: string): Promise<SessionDoc[]> {
    try {
      const queryParam = appId && appId !== 'all' ? `?appId=${encodeURIComponent(appId)}` : '';
      const res = await fetch(`${this.baseUrl}/api/v1/sessions${queryParam}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.sessions || [];
    } catch (err) {
      console.error('[SpokeOps Service] Error fetching sessions:', err);
      return [];
    }
  }

  async getAuditEvents(appId?: string): Promise<AuditEventDoc[]> {
    try {
      const queryParam = appId && appId !== 'all' ? `?appId=${encodeURIComponent(appId)}` : '';
      const res = await fetch(`${this.baseUrl}/api/v1/events${queryParam}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.events || [];
    } catch (err) {
      console.error('[SpokeOps Service] Error fetching audit events:', err);
      return [];
    }
  }

  async disconnectSession(sessionId: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/sessions/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, reason: 'Administrative eviction by Ops Admin' })
      });
      return res.ok;
    } catch (err) {
      console.error('[SpokeOps Service] Error evicting session:', err);
      return false;
    }
  }
}

export const telemetryService: TelemetryService = new LiveApiTelemetryService();
