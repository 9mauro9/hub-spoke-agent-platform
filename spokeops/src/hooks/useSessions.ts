import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { telemetryService } from '../services/firebase';
import { SessionDoc, SessionStatus } from '../types/telemetry';
import { useTenantFilter } from '../context/TenantFilterContext';
import { useAuth } from '../context/AuthContext';

export interface UseSessionsOptions {
  statusFilter?: SessionStatus | 'all';
}

export const useSessions = (options: UseSessionsOptions = {}) => {
  const { selectedTenant, searchQuery } = useTenantFilter();
  const { isOpsAdmin } = useAuth();
  const queryClient = useQueryClient();
  const statusFilter = options.statusFilter || 'all';

  const query = useQuery<SessionDoc[]>({
    queryKey: ['sessions', selectedTenant],
    queryFn: async () => {
      return telemetryService.getSessions(selectedTenant);
    },
    refetchInterval: 10000 // Poll every 10 seconds for real-time presence
  });

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

  let sessions = query.data || [];

  // Filter by status
  if (statusFilter !== 'all') {
    sessions = sessions.filter((s) => s.status === statusFilter);
  }

  // Filter by search query (user email, user ID, session ID)
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    sessions = sessions.filter(
      (s) =>
        s.userEmail.toLowerCase().includes(q) ||
        s.userId.toLowerCase().includes(q) ||
        s.sessionId.toLowerCase().includes(q) ||
        s.appId.toLowerCase().includes(q) ||
        s.userRoles.some((r) => r.toLowerCase().includes(q))
    );
  }

  const activeCount = sessions.filter((s) => s.status === 'active').length;
  const idleCount = sessions.filter((s) => s.status === 'idle').length;
  const timedOutCount = sessions.filter((s) => s.status === 'timed_out').length;

  return {
    ...query,
    sessions,
    activeCount,
    idleCount,
    timedOutCount,
    disconnectSession: disconnectMutation.mutateAsync,
    isDisconnecting: disconnectMutation.isPending
  };
};
