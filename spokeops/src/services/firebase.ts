/**
 * Central Telemetry Service Layer for SpokeOps Operations Console
 * Communicates with Central Ingestion API (/api/v1) with cursor-based pagination and range support.
 */
import {
  TenantRegistryDoc,
  SessionDoc,
  AuditEventDoc,
  TelemetryQueryParams,
  PaginatedTelemetryResponse
} from '../types/telemetry';
import { telemetryService as coreTelemetryService } from './telemetry';
import { auditService as coreAuditService } from './audit';

export type PaginatedArray<T> = T[] & {
  nextCursor?: string | null;
  total?: number;
  hasMore?: boolean;
  indexUrl?: string | null;
};

export interface TelemetryService {
  getTenants(): Promise<TenantRegistryDoc[]>;
  getSessions(options?: string | TelemetryQueryParams): Promise<PaginatedArray<SessionDoc>>;
  querySessions(options: TelemetryQueryParams): Promise<PaginatedTelemetryResponse<SessionDoc>>;
  getAuditEvents(options?: string | TelemetryQueryParams): Promise<PaginatedArray<AuditEventDoc>>;
  queryAuditEvents(options: TelemetryQueryParams): Promise<PaginatedTelemetryResponse<AuditEventDoc>>;
  disconnectSession(sessionId: string): Promise<boolean>;
}

class TelemetryServiceBridge implements TelemetryService {
  async getTenants(): Promise<TenantRegistryDoc[]> {
    return coreTelemetryService.getTenants();
  }

  async getSessions(options?: string | TelemetryQueryParams): Promise<PaginatedArray<SessionDoc>> {
    const res = await coreTelemetryService.getSessions(options);
    const arr = [...res.data] as PaginatedArray<SessionDoc>;
    arr.nextCursor = res.nextCursor;
    arr.total = res.total;
    arr.hasMore = res.hasMore;
    arr.indexUrl = res.indexUrl;
    return arr;
  }

  async querySessions(options: TelemetryQueryParams): Promise<PaginatedTelemetryResponse<SessionDoc>> {
    return coreTelemetryService.getSessions(options);
  }

  async getAuditEvents(options?: string | TelemetryQueryParams): Promise<PaginatedArray<AuditEventDoc>> {
    const res = await coreAuditService.getAuditEvents(options);
    const arr = [...res.data] as PaginatedArray<AuditEventDoc>;
    arr.nextCursor = res.nextCursor;
    arr.total = res.total;
    arr.hasMore = res.hasMore;
    arr.indexUrl = res.indexUrl;
    return arr;
  }

  async queryAuditEvents(options: TelemetryQueryParams): Promise<PaginatedTelemetryResponse<AuditEventDoc>> {
    return coreAuditService.getAuditEvents(options);
  }

  async disconnectSession(sessionId: string): Promise<boolean> {
    return coreTelemetryService.disconnectSession(sessionId);
  }
}

export const telemetryService: TelemetryService = new TelemetryServiceBridge();
export { coreTelemetryService, coreAuditService };
