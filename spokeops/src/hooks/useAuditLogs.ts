import { useQuery } from '@tanstack/react-query';
import { telemetryService } from '../services/firebase';
import { AuditEventDoc, AuditSeverity, AuditAction } from '../types/telemetry';
import { useTenantFilter } from '../context/TenantFilterContext';

export interface UseAuditLogsOptions {
  severityFilter?: AuditSeverity | 'all';
  actionFilter?: AuditAction | 'all';
}

export const useAuditLogs = (options: UseAuditLogsOptions = {}) => {
  const { selectedTenant, searchQuery, dateRange } = useTenantFilter();
  const severityFilter = options.severityFilter || 'all';
  const actionFilter = options.actionFilter || 'all';

  const query = useQuery<AuditEventDoc[]>({
    queryKey: ['audit-events', selectedTenant],
    queryFn: async () => {
      return telemetryService.getAuditEvents(selectedTenant);
    },
    refetchInterval: 12000 // Poll every 12 seconds
  });

  let events = query.data || [];

  // Filter by severity
  if (severityFilter !== 'all') {
    events = events.filter((e) => e.status === severityFilter);
  }

  // Filter by action
  if (actionFilter !== 'all') {
    events = events.filter((e) => e.action === actionFilter);
  }

  // Filter by search query
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    events = events.filter(
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

  // Filter by date range
  const now = Date.now();
  let timeLimitMs = 0;
  if (dateRange === '15m') timeLimitMs = 15 * 60 * 1000;
  else if (dateRange === '1h') timeLimitMs = 60 * 60 * 1000;
  else if (dateRange === '24h') timeLimitMs = 24 * 60 * 60 * 1000;
  else if (dateRange === '7d') timeLimitMs = 7 * 24 * 60 * 60 * 1000;

  if (timeLimitMs > 0) {
    events = events.filter((e) => {
      const eventTime = new Date(e.timestamp).getTime();
      return now - eventTime <= timeLimitMs;
    });
  }

  const deniedCount = events.filter((e) => e.status === 'denied').length;
  const warningCount = events.filter((e) => e.status === 'warning').length;
  const successCount = events.filter((e) => e.status === 'success').length;

  return {
    ...query,
    events,
    deniedCount,
    warningCount,
    successCount
  };
};
