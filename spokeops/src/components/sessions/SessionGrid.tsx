import React, { useState } from 'react';
import { SessionDoc } from '../../types/telemetry';
import { DataTable, Column } from '../common/DataTable';
import { Badge } from '../common/Badge';
import { SessionDurationCounter } from './SessionDurationCounter';
import { SessionDetailModal } from './SessionDetailModal';
import { useAuth } from '../../context/AuthContext';
import { LogOut, Monitor, Shield, Info, Lock, AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react';

interface SessionGridProps {
  sessions: SessionDoc[];
  isLoading?: boolean;
  isColdQueryLoading?: boolean;
  isOlderHistoricalEmpty?: boolean;
  indexErrorUrl?: string | null;
  onResetRange?: () => void;
  onDisconnect?: (sessionId: string) => void;
}

export const SessionGrid: React.FC<SessionGridProps> = ({
  sessions,
  isLoading = false,
  isColdQueryLoading = false,
  isOlderHistoricalEmpty = false,
  indexErrorUrl = null,
  onResetRange,
  onDisconnect
}) => {
  const { isOpsAdmin, maskIpAddress } = useAuth();
  const [selectedSession, setSelectedSession] = useState<SessionDoc | null>(null);
  const [sessionToEvict, setSessionToEvict] = useState<SessionDoc | null>(null);

  const statusVariantMap = {
    active: 'success' as const,
    idle: 'warning' as const,
    timed_out: 'neutral' as const,
    closed: 'neutral' as const
  };

  const columns: Column<SessionDoc>[] = [
    {
      header: 'Status',
      className: 'w-24',
      cell: (item) => (
        <Badge
          variant={statusVariantMap[item.status]}
          size="xs"
          pulse={item.status === 'active'}
        >
          {item.status.replace('_', ' ')}
        </Badge>
      )
    },
    {
      header: 'User & Tenant',
      cell: (item) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-100 flex items-center gap-1.5">
            {item.userEmail}
          </span>
          <span className="text-[11px] text-slate-500 font-mono">
            app: <span className="text-brand-400">{item.appId}</span> · {item.userId}
          </span>
        </div>
      )
    },
    {
      header: 'RBAC Roles',
      cell: (item) => (
        <div className="flex flex-wrap gap-1 max-w-[220px]">
          {item.userRoles.map((role) => (
            <Badge key={role} variant="purple" size="xs">
              {role}
            </Badge>
          ))}
        </div>
      )
    },
    {
      header: 'Client & Network',
      cell: (item) => (
        <div className="flex flex-col text-[11px]">
          <span className="text-slate-300 font-medium">
            {item.clientMetadata.browser} · {item.clientMetadata.os}
          </span>
          <span className="text-slate-500 font-mono flex items-center gap-1">
            <span>IP: {maskIpAddress(item.clientMetadata.ipAddress)}</span>
            <span className="text-slate-600">({item.clientMetadata.viewport})</span>
          </span>
        </div>
      )
    },
    {
      header: 'Live Duration',
      cell: (item) => (
        <SessionDurationCounter
          startedAt={item.startedAt}
          initialDurationSeconds={item.durationSeconds}
          status={item.status}
        />
      )
    },
    {
      header: 'Last Heartbeat',
      cell: (item) => {
        const date = new Date(item.lastHeartbeat);
        return (
          <span className="text-[11px] font-mono text-slate-400">
            {date.toLocaleTimeString()}
          </span>
        );
      }
    },
    {
      header: 'Actions',
      className: 'text-right',
      cell: (item) => {
        const canDisconnect = item.status === 'active' || item.status === 'idle';

        if (!canDisconnect) {
          return (
            <span className="text-[11px] text-slate-600 font-mono uppercase">Inactive</span>
          );
        }

        return (
          <div
            className="flex items-center justify-end gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedSession(item)}
              title="Inspect Telemetry Details"
              className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <Info className="w-3.5 h-3.5" />
            </button>

            <button
              disabled={!isOpsAdmin}
              onClick={() => onDisconnect && onDisconnect(item.sessionId)}
              title={
                isOpsAdmin
                  ? 'Force Disconnect Session'
                  : 'Eviction restricted to Ops Admin (Help Desk view-only)'
              }
              className={`p-1 rounded text-xs transition-colors flex items-center gap-1 ${
                isOpsAdmin
                  ? 'bg-rose-950/60 text-rose-300 border border-rose-800/80 hover:bg-rose-900'
                  : 'bg-slate-800/40 text-slate-600 border border-slate-800 cursor-not-allowed'
              }`}
            >
              {isOpsAdmin ? (
                <LogOut className="w-3.5 h-3.5" />
              ) : (
                <Lock className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        );
      }
    }
  ];

  const emptyTitle = isOlderHistoricalEmpty
    ? 'No sessions older than 7 days'
    : 'No active sessions detected';

  const emptyDescription = isOlderHistoricalEmpty
    ? 'Zero session records older than 7 days exist for this spoke. Telemetry retention or presence data may be limited to recent activity.'
    : 'Sessions will populate as users interact with connected Spoke applications.';

  const emptyAction = isOlderHistoricalEmpty && onResetRange ? (
    <button
      onClick={onResetRange}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium shadow-sm transition-colors"
    >
      <RefreshCw className="w-3.5 h-3.5" />
      <span>Switch to 7-Day Window</span>
    </button>
  ) : undefined;

  return (
    <>
      {indexErrorUrl && (
        <div className="mb-4 rounded-lg bg-amber-950/80 border border-amber-800 p-3 text-xs text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Firestore Composite Index Required:</strong> This range query requires a specialized Firestore composite index.
            </span>
          </div>
          <a
            href={indexErrorUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-900 hover:bg-amber-800 text-amber-100 font-semibold text-[11px] border border-amber-700 transition-colors w-fit"
          >
            <span>Create Index in Console</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      <DataTable
        data={sessions}
        columns={columns}
        keyExtractor={(item) => item.sessionId}
        isLoading={isLoading}
        isColdQueryLoading={isColdQueryLoading}
        onRowClick={(item) => setSelectedSession(item)}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        emptyAction={emptyAction}
      />

      <SessionDetailModal
        session={selectedSession}
        isOpen={!!selectedSession}
        onClose={() => setSelectedSession(null)}
        onDisconnect={onDisconnect}
      />
    </>
  );
};
