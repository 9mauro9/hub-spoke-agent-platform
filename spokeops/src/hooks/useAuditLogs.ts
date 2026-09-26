import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { telemetryService } from '../services/firebase';
import { AuditEventDoc, AuditSeverity, AuditAction, PaginatedTelemetryResponse } from '../types/telemetry';
import { useTenantFilter } from '../context/TenantFilterContext';
import { calculateLowerBoundMs, SEVEN_DAYS_MS } from '../store/telemetryStore';

export interface UseAuditLogsOptions {
  severityFilter?: AuditSeverity | 'all';
  actionFilter?: AuditAction | 'all';
}

export const useAuditLogs = (options: UseAuditLogsOptions = {}) => {
  const { selectedTenant, searchQuery, dateRange } = useTenantFilter();
  const severityFilter = options.severityFilter || 'all';
  const actionFilter = options.actionFilter || 'all';

  const [extraEvents, setExtraEvents] = useState<AuditEventDoc[]>([]);
  const [currentCursor, setCurrentCursor] = useState<string | null>(null);
  const [hasNextCursor, setHasNextCursor] = useState<string | null>(null);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState<boolean>(false);

  // Reset pagination accumulator whenever filtering context mutates
  useEffect(() => {
    setExtraEvents([]);
    setCurrentCursor(null);
    setHasNextCursor(null);
  }, [selectedTenant, dateRange, severityFilter, actionFilter]);

  const query = useQuery<PaginatedTelemetryResponse<AuditEventDoc>>({
    queryKey: ['audit-events', selectedTenant, dateRange, severityFilter, actionFilter],
    queryFn: async () => {
      const res = await telemetryService.queryAuditEvents({
        appId: selectedTenant,
        range: dateRange,
        status: severityFilter,
        action: actionFilter,
        limit: 50
      });
      return res;
    },
    refetchInterval: 12000 // Poll every 12 seconds
  });

  // Synchronize next cursor from primary page
  useEffect(() => {
    if (query.data && extraEvents.length === 0) {
      setHasNextCursor(query.data.nextCursor || null);
    }
  }, [query.data, extraEvents.length]);

  const loadMore = useCallback(async () => {
    const cursorToUse = currentCursor || query.data?.nextCursor;
    if (!cursorToUse || isFetchingNextPage) return;

    setIsFetchingNextPage(true);
    try {
      const pageRes = await telemetryService.queryAuditEvents({
        appId: selectedTenant,
        range: dateRange,
        status: severityFilter,
        action: actionFilter,
        cursor: cursorToUse,
        limit: 50
      });

      if (pageRes.data.length > 0) {
        setExtraEvents((prev) => {
          const existingIds = new Set(prev.map((e) => e.eventId));
          const fresh = pageRes.data.filter((e) => !existingIds.has(e.eventId));
          return [...prev, ...fresh];
        });
      }
      setCurrentCursor(pageRes.nextCursor || null);
      setHasNextCursor(pageRes.nextCursor || null);
    } catch (err) {
      console.error('[SpokeOps Audit Hook] Pagination error:', err);
    } finally {
      setIsFetchingNextPage(false);
    }
  }, [
    currentCursor,
    query.data?.nextCursor,
    isFetchingNextPage,
    selectedTenant,
    dateRange,
    severityFilter,
    actionFilter
  ]);

  // Combine initial query data with accumulated paginated pages
  const combined = useMemo(() => {
    const initial = query.data?.data || [];
    if (extraEvents.length === 0) return initial;
    const seen = new Set(initial.map((e) => e.eventId));
    const merged = [...initial];
    for (const e of extraEvents) {
      if (!seen.has(e.eventId)) {
        seen.add(e.eventId);
        merged.push(e);
      }
    }
    return merged;
  }, [query.data?.data, extraEvents]);

  // Apply in-memory secondary filters if needed
  let events = useMemo(() => {
    let list = [...combined];

    if (severityFilter !== 'all') {
      list = list.filter((e) => e.status === severityFilter);
    }

    if (actionFilter !== 'all') {
      list = list.filter((e) => e.action === actionFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
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

    // Apply strict range filtering relative to Date.now()
    const now = Date.now();
    const lowerBoundMs = calculateLowerBoundMs(dateRange, now);
    if (lowerBoundMs !== null) {
      list = list.filter((e) => new Date(e.timestamp).getTime() >= lowerBoundMs);
    }

    // Order by timestamp desc
    list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return list;
  }, [combined, severityFilter, actionFilter, searchQuery, dateRange]);

  const now = Date.now();
  const hasOlderThan7Days = useMemo(() => {
    return events.some((e) => now - new Date(e.timestamp).getTime() > SEVEN_DAYS_MS);
  }, [events, now]);

  const isOlderHistoricalEmpty = useMemo(() => {
    return (dateRange === '30d' || dateRange === 'ALL') && !hasOlderThan7Days;
  }, [dateRange, hasOlderThan7Days]);

  const deniedCount = useMemo(() => events.filter((e) => e.status === 'denied').length, [events]);
  const warningCount = useMemo(() => events.filter((e) => e.status === 'warning').length, [events]);
  const successCount = useMemo(() => events.filter((e) => e.status === 'success').length, [events]);

  const indexErrorUrl = query.data?.indexUrl || null;
  const hasMore = !!hasNextCursor;

  return {
    ...query,
    events,
    deniedCount,
    warningCount,
    successCount,
    loadMore,
    hasMore,
    isFetchingNextPage,
    isOlderHistoricalEmpty,
    indexErrorUrl
  };
};
