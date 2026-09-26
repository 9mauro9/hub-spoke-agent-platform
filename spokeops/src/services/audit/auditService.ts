import { AuditEventDoc, TelemetryQueryParams, PaginatedTelemetryResponse } from '../../types/telemetry';
import { browserMockStore } from '../mockData';

export interface AuditServiceContract {
  getAuditEvents(options?: string | TelemetryQueryParams): Promise<PaginatedTelemetryResponse<AuditEventDoc>>;
}

export class AuditService implements AuditServiceContract {
  private baseUrl: string;

  constructor() {
    this.baseUrl = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) || '';
  }

  async getAuditEvents(options?: string | TelemetryQueryParams): Promise<PaginatedTelemetryResponse<AuditEventDoc>> {
    const params: TelemetryQueryParams = typeof options === 'string' ? { appId: options } : options || {};
    const queryParts: string[] = [];

    if (params.appId && params.appId !== 'all') queryParts.push(`appId=${encodeURIComponent(params.appId)}`);
    if (params.range) queryParts.push(`range=${encodeURIComponent(params.range)}`);
    if (params.cursor) queryParts.push(`cursor=${encodeURIComponent(params.cursor)}`);
    if (params.limit) queryParts.push(`limit=${encodeURIComponent(params.limit.toString())}`);
    if (params.status && params.status !== 'all') queryParts.push(`status=${encodeURIComponent(params.status)}`);
    if (params.action && params.action !== 'all') queryParts.push(`action=${encodeURIComponent(params.action)}`);
    if (params.search) queryParts.push(`search=${encodeURIComponent(params.search)}`);

    const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';

    try {
      const res = await fetch(`${this.baseUrl}/api/v1/events${queryString}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.indexUrl) {
        console.error('[SpokeOps Firestore Index Required] Index URL pointer:', data.indexUrl);
      }

      return {
        data: data.events || [],
        nextCursor: data.nextCursor || null,
        total: typeof data.total === 'number' ? data.total : (data.events ? data.events.length : 0),
        hasMore: !!data.hasMore,
        range: data.range || params.range,
        indexUrl: data.indexUrl || null
      };
    } catch (err: any) {
      console.warn('[SpokeOps Audit Service] API fetch error, falling back to local store:', err);

      let list = browserMockStore.getEvents();
      if (params.appId && params.appId !== 'all') {
        list = list.filter((e) => e.appId === params.appId);
      }
      if (params.status && params.status !== 'all') {
        list = list.filter((e) => e.status === params.status);
      }
      if (params.action && params.action !== 'all') {
        list = list.filter((e) => e.action === params.action);
      }
      if (params.search) {
        const q = params.search.toLowerCase();
        list = list.filter(
          (e) =>
            e.userEmail.toLowerCase().includes(q) ||
            e.userId.toLowerCase().includes(q) ||
            e.resourceId.toLowerCase().includes(q) ||
            e.resourceType.toLowerCase().includes(q) ||
            e.eventId.toLowerCase().includes(q) ||
            e.roleAtExecution.toLowerCase().includes(q) ||
            JSON.stringify(e.metadata).toLowerCase().includes(q)
        );
      }

      const timeLimitMs = getRangeLimitMs(params.range);
      if (timeLimitMs !== null) {
        const lowerBound = Date.now() - timeLimitMs;
        list = list.filter((e) => new Date(e.timestamp).getTime() >= lowerBound);
      }

      // Strictly orderBy timestamp desc
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      const limit = params.limit || 50;
      let startIndex = 0;
      if (params.cursor) {
        const found = list.findIndex((e) => e.eventId === params.cursor || e.timestamp === params.cursor);
        if (found !== -1) startIndex = found + 1;
      }
      const sliced = list.slice(startIndex, startIndex + limit + 1);
      const hasMore = sliced.length > limit;
      const items = hasMore ? sliced.slice(0, limit) : sliced;
      const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].timestamp : null;

      return {
        data: items,
        nextCursor,
        total: list.length,
        hasMore,
        range: params.range
      };
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

export const auditService = new AuditService();
