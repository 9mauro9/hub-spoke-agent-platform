import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { telemetryService } from '../services/firebase';
import { SessionDoc, SessionStatus, PaginatedTelemetryResponse } from '../types/telemetry';
import { useTenantFilter } from '../context/TenantFilterContext';
import { useAuth } from '../context/AuthContext';
import { calculateLowerBoundMs, SEVEN_DAYS_MS } from '../store/telemetryStore';

export interface UseSessionsOptions {
  statusFilter?: SessionStatus | 'all';
}

export const useSessions = (options: UseSessionsOptions = {}) => {
  const { selectedTenant, searchQuery, dateRange } = useTenantFilter();
  const { isOpsAdmin } = useAuth();
  const queryClient = useQueryClient();
  const statusFilter = options.statusFilter || 'all';

  const [extraSessions, setExtraSessions] = useState<SessionDoc[]>([]);
  const [currentCursor, setCurrentCursor] = useState<string | null>(null);
  const [hasNextCursor, setHasNextCursor] = useState<string | null>(null);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState<boolean>(false);

  // Reset pagination state when filters or tenant change
  useEffect(() => {
    setExtraSessions([]);
    setCurrentCursor(null);
    setHasNextCursor(null);
  }, [selectedTenant, dateRange, statusFilter]);

  const query = useQuery<PaginatedTelemetryResponse<SessionDoc>>({
    queryKey: ['sessions', selectedTenant, dateRange, statusFilter],
    queryFn: async () => {
      const res = await telemetryService.querySessions({
        appId: selectedTenant,
        range: dateRange,
        status: statusFilter,
        limit: 50
      });
      return res;
    },
    refetchInterval: 10000 // Poll every 10 seconds for real-time presence
  });

  // Track next cursor
  useEffect(() => {
    if (query.data && extraSessions.length === 0) {
      setHasNextCursor(query.data.nextCursor || null);
    }
  }, [query.data, extraSessions.length]);

  const loadMore = useCallback(async () => {
    const cursorToUse = currentCursor || query.data?.nextCursor;
    if (!cursorToUse || isFetchingNextPage) return;

    setIsFetchingNextPage(true);
    try {
      const pageRes = await telemetryService.querySessions({
        appId: selectedTenant,
        range: dateRange,
        status: statusFilter,
        cursor: cursorToUse,
        limit: 50
      });

      if (pageRes.data.length > 0) {
        setExtraSessions((prev) => {
          const existingIds = new Set(prev.map((s) => s.sessionId));
          const fresh = pageRes.data.filter((s) => !existingIds.has(s.sessionId));
          return [...prev, ...fresh];
        });
      }
      setCurrentCursor(pageRes.nextCursor || null);
      setHasNextCursor(pageRes.nextCursor || null);
    } catch (err) {
      console.error('[SpokeOps Sessions Hook] Pagination error:', err);
    } finally {
      setIsFetchingNextPage(false);
    }
  }, [
    currentCursor,
    query.data?.nextCursor,
    isFetchingNextPage,
    selectedTenant,
    dateRange,
    statusFilter
  ]);

  const disconnectMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      if (!isOpsAdmin) {
        throw new Error('Unauthorized: Only Ops Admins can evict active sessions.');
      }
      return telemetryService.disconnectSession(sessionId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['audit-events'] });
    }
  });

  const now = Date.now();
  const TIMEOUT_MS = 6 * 60 * 1000;

  // Merge primary query sessions with paginated pages
  const combined = useMemo(() => {
    const initial = query.data?.data || [];
    if (extraSessions.length === 0) return initial;
    const seen = new Set(initial.map((s) => s.sessionId));
    const merged = [...initial];
    for (const s of extraSessions) {
      if (!seen.has(s.sessionId)) {
        seen.add(s.sessionId);
        merged.push(s);
      }
    }
    return merged;
  }, [query.data?.data, extraSessions]);

  // Resolve dynamic presence status & filtering
  const sessions = useMemo(() => {
    let list = combined.map((s) => {
      if (s.status === 'active' || s.status === 'idle') {
        const elapsed = now - new Date(s.lastHeartbeat).getTime();
        if (elapsed > TIMEOUT_MS) {
          return { ...s, status: 'timed_out' as const };
        }
      }
      return s;
    });

    if (statusFilter !== 'all') {
      list = list.filter((s) => s.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.userEmail.toLowerCase().includes(q) ||
          s.userId.toLowerCase().includes(q) ||
          s.sessionId.toLowerCase().includes(q) ||
          s.appId.toLowerCase().includes(q) ||
          s.userRoles.some((r) => r.toLowerCase().includes(q))
      );
    }

    // Apply strict range filtering relative to Date.now()
    const lowerBoundMs = calculateLowerBoundMs(dateRange, now);
    if (lowerBoundMs !== null) {
      list = list.filter((s) => {
        const hb = new Date(s.lastHeartbeat).getTime();
        const st = new Date(s.startedAt).getTime();
        return hb >= lowerBoundMs || st >= lowerBoundMs;
      });
    }

    // Sort by lastHeartbeat desc
    list.sort((a, b) => new Date(b.lastHeartbeat).getTime() - new Date(a.lastHeartbeat).getTime());
    return list;
  }, [combined, now, statusFilter, searchQuery, dateRange]);

  const hasOlderThan7Days = useMemo(() => {
    return sessions.some((s) => {
      const hb = new Date(s.lastHeartbeat).getTime();
      const st = new Date(s.startedAt).getTime();
      return (now - hb > SEVEN_DAYS_MS) || (now - st > SEVEN_DAYS_MS);
    });
  }, [sessions, now]);

  const isOlderHistoricalEmpty = useMemo(() => {
    return (dateRange === '30d' || dateRange === 'ALL') && !hasOlderThan7Days;
  }, [dateRange, hasOlderThan7Days]);

  const activeCount = useMemo(() => sessions.filter((s) => s.status === 'active').length, [sessions]);
  const idleCount = useMemo(() => sessions.filter((s) => s.status === 'idle').length, [sessions]);
  const timedOutCount = useMemo(() => sessions.filter((s) => s.status === 'timed_out').length, [sessions]);

  const indexErrorUrl = query.data?.indexUrl || null;
  const hasMore = !!hasNextCursor;

  return {
    ...query,
    sessions,
    activeCount,
    idleCount,
    timedOutCount,
    disconnectSession: disconnectMutation.mutateAsync,
    isDisconnecting: disconnectMutation.isPending,
    loadMore,
    hasMore,
    isFetchingNextPage,
    isOlderHistoricalEmpty,
    indexErrorUrl
  };
};
