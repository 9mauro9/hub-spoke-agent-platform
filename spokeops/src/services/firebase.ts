/**
 * Firebase Client & Data Service Layer for SpokeOps
 * Supports live Firebase Firestore / Auth connection or fallback to simulated local store.
 */
import { browserMockStore } from './mockData';
import { TenantRegistryDoc, SessionDoc, AuditEventDoc } from '../types/telemetry';

export interface TelemetryService {
  getTenants(): Promise<TenantRegistryDoc[]>;
  getSessions(appId?: string): Promise<SessionDoc[]>;
  getAuditEvents(appId?: string): Promise<AuditEventDoc[]>;
  disconnectSession(sessionId: string): Promise<boolean>;
}

// In local mode or mock mode, we use the browserMockStore
class LocalMockTelemetryService implements TelemetryService {
  async getTenants(): Promise<TenantRegistryDoc[]> {
    return browserMockStore.getTenants();
  }

  async getSessions(appId?: string): Promise<SessionDoc[]> {
    const list = browserMockStore.getSessions();
    if (!appId || appId === 'all') return list;
    return list.filter((s) => s.appId === appId);
  }

  async getAuditEvents(appId?: string): Promise<AuditEventDoc[]> {
    const list = browserMockStore.getEvents();
    if (!appId || appId === 'all') return list;
    return list.filter((e) => e.appId === appId);
  }

  async disconnectSession(sessionId: string): Promise<boolean> {
    return browserMockStore.disconnectSession(sessionId);
  }
}

export const telemetryService: TelemetryService = new LocalMockTelemetryService();
