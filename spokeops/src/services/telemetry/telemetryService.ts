import { SessionDoc, TenantRegistryDoc, TelemetryQueryParams, PaginatedTelemetryResponse } from '../../types/telemetry';
import { browserMockStore } from '../mockData';

export interface TelemetryServiceContract {
  getTenants(): Promise<TenantRegistryDoc[]>;
  getSessions(options?: string | TelemetryQueryParams): Promise<PaginatedTelemetryResponse<SessionDoc>>;
  disconnectSession(sessionId: string): Promise<boolean>;
}

export class TelemetryService implements TelemetryServiceContract {
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
      console.warn('[SpokeOps Telemetry Service] Failed to fetch tenants from API, falling back to mock store:', err);
      return browserMockStore.getTenants();
    }
  }

  async getSessions(options?: string | TelemetryQueryParams): Promise<PaginatedTelemetryResponse<SessionDoc>> {
    const params: TelemetryQueryParams = typeof options === 'string' ? { appId: options } : options || {};
    const queryParts: string[] = [];

    if (params.appId && params.appId !== 'all') queryParts.push(`appId=${encodeURIComponent(params.appId)}`);
    if (params.range) queryParts.push(`range=${encodeURIComponent(params.range)}`);
    if (params.cursor) queryParts.push(`cursor=${encodeURIComponent(params.cursor)}`);
    if (params.limit) queryParts.push(`limit=${encodeURIComponent(params.limit.toString())}`);
    if (params.status && params.status !== 'all') queryParts.push(`status=${encodeURIComponent(params.status)}`);
    if (params.search) queryParts.push(`search=${encodeURIComponent(params.search)}`);

    const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';

    try {
      const res = await fetch(`${this.baseUrl}/api/v1/sessions${queryString}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.indexUrl) {
        console.error('[SpokeOps Firestore Index Required] Index URL pointer:', data.indexUrl);
      }

      return {
        data: data.sessions || [],
        nextCursor: data.nextCursor || null,
        total: typeof data.total === 'number' ? data.total : (data.sessions ? data.sessions.length : 0),
        hasMore: !!data.hasMore,
        range: data.range || params.range,
        indexUrl: data.indexUrl || null
      };
    } catch (err: any) {
      console.warn('[SpokeOps Telemetry Service] API fetch error, falling back to local store:', err);

      let list = browserMockStore.getSessions();
      if (params.appId && params.appId !== 'all') {
        list = list.filter((s) => s.appId === params.appId);
      }
      if (params.status && params.status !== 'all') {
        list = list.filter((s) => s.status === params.status);
      }
      if (params.search) {
        const q = params.search.toLowerCase();
        list = list.filter(
          (s) =>
            s.userEmail.toLowerCase().includes(q) ||
            s.userId.toLowerCase().includes(q) ||
            s.sessionId.toLowerCase().includes(q)
        );
      }

      const timeLimitMs = getRangeLimitMs(params.range);
      if (timeLimitMs !== null) {
        const lowerBound = Date.now() - timeLimitMs;
        list = list.filter(
          (s) =>
            new Date(s.lastHeartbeat).getTime() >= lowerBound ||
            new Date(s.startedAt).getTime() >= lowerBound
        );
      }

      list.sort((a, b) => new Date(b.lastHeartbeat).getTime() - new Date(a.lastHeartbeat).getTime());

      const limit = params.limit || 50;
      let startIndex = 0;
      if (params.cursor) {
        const found = list.findIndex((s) => s.sessionId === params.cursor || s.lastHeartbeat === params.cursor);
        if (found !== -1) startIndex = found + 1;
      }
      const sliced = list.slice(startIndex, startIndex + limit + 1);
      const hasMore = sliced.length > limit;
      const items = hasMore ? sliced.slice(0, limit) : sliced;
      const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].lastHeartbeat : null;

      return {
        data: items,
        nextCursor,
        total: list.length,
        hasMore,
        range: params.range
      };
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
      console.warn('[SpokeOps Telemetry Service] Disconnect API error, applying to mock store:', err);
      return browserMockStore.disconnectSession(sessionId);
    }
  }
}

function getRangeLimitMs(range?: string): number | null {
  if (!range || range === 'ALL') return null;
  switch (range) {
    case '15m': return 15 * 60 * 1000;
    case '1h': return 60 * 60 * 1000;
    case '24h': return 24 * 60 * 60 * 1000;
    case '7d': return 7 * 24 * 60 * 60 * 1000;
    case '30d': return 30 * 24 * 60 * 60 * 1000;
    default: return null;
  }
}

export const telemetryService = new TelemetryService();
