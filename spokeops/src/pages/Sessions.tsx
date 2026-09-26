import React, { useState } from 'react';
import { useSessions } from '../hooks/useSessions';
import { useAuth } from '../context/AuthContext';
import { useTenantFilter } from '../context/TenantFilterContext';
import { SessionGrid } from '../components/sessions/SessionGrid';
import { SessionStatus } from '../types/telemetry';
import {
  Download,
  Filter,
  Users,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  Lock
} from 'lucide-react';

export const Sessions: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<SessionStatus | 'all'>('all');
  const {
    sessions,
    activeCount,
    idleCount,
    timedOutCount,
    isLoading,
    isFetching,
    disconnectSession,
    loadMore,
    hasMore,
    isFetchingNextPage,
    isOlderHistoricalEmpty,
    indexErrorUrl
  } = useSessions({
    statusFilter
  });
  const { isOpsAdmin, persona } = useAuth();
  const { selectedTenantMeta, setDateRange, dateRange } = useTenantFilter();
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const statusTabs: { label: string; value: SessionStatus | 'all'; count?: number }[] = [
    { label: 'All Sessions', value: 'all' },
    { label: 'Active', value: 'active', count: activeCount },
    { label: 'Idle', value: 'idle', count: idleCount },
    { label: 'Timed Out', value: 'timed_out', count: timedOutCount },
    { label: 'Closed', value: 'closed' }
  ];

  const handleExportCSV = () => {
    if (!isOpsAdmin) {
      setExportNotice('Telemetry export is restricted to Ops Administrators.');
      setTimeout(() => setExportNotice(null), 4000);
      return;
    }

    const headers = [
      'SessionID',
      'AppID',
      'UserEmail',
      'UserID',
      'Roles',
      'Status',
      'IPAddress',
      'Browser',
      'OS',
      'StartedAt',
      'LastHeartbeat',
      'DurationSeconds'
    ];

    const rows = sessions.map((s) => [
      s.sessionId,
      s.appId,
      s.userEmail,
      s.userId,
      `"${s.userRoles.join(';')}"`,
      s.status,
      s.clientMetadata.ipAddress,
      `"${s.clientMetadata.browser}"`,
      `"${s.clientMetadata.os}"`,
      s.startedAt,
      s.lastHeartbeat,
      s.durationSeconds
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `spokeops_sessions_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJSON = () => {
    if (!isOpsAdmin) {
      setExportNotice('Telemetry export is restricted to Ops Administrators.');
      setTimeout(() => setExportNotice(null), 4000);
      return;
    }

    const jsonContent = JSON.stringify(sessions, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `spokeops_sessions_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-brand-400" />
            <span>Live Presence & Session Monitor</span>
            {selectedTenantMeta && (
              <span className="text-xs font-mono text-slate-400 font-normal">
                ({selectedTenantMeta.appName})
              </span>
            )}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time dual-cadence heartbeat tracking and user session presence across enterprise spokes.
          </p>
        </div>

        {/* Action Controls & Export */}
        <div className="flex items-center gap-2">
          {exportNotice && (
            <span className="text-xs text-amber-400 bg-amber-950/80 border border-amber-800/80 px-2.5 py-1 rounded-md flex items-center gap-1.5 animate-in fade-in duration-150">
              <AlertCircle className="w-3.5 h-3.5" />
              {exportNotice}
            </span>
          )}

          <div className="flex items-center rounded-lg border border-slate-800 bg-slate-900 p-0.5 text-xs">
            <button
              onClick={handleExportCSV}
              title={isOpsAdmin ? 'Export telemetry to CSV' : 'Export restricted to Ops Admin'}
              className={`px-2.5 py-1 rounded flex items-center gap-1.5 transition-colors ${
                isOpsAdmin
                  ? 'text-slate-300 hover:text-white hover:bg-slate-800'
                  : 'text-slate-600 cursor-not-allowed'
              }`}
            >
              {isOpsAdmin ? <Download className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
              <span>CSV</span>
            </button>
            <div className="w-[1px] h-3 bg-slate-800" />
            <button
              onClick={handleExportJSON}
              title={isOpsAdmin ? 'Export telemetry to JSON' : 'Export restricted to Ops Admin'}
              className={`px-2.5 py-1 rounded flex items-center gap-1.5 transition-colors ${
                isOpsAdmin
                  ? 'text-slate-300 hover:text-white hover:bg-slate-800'
                  : 'text-slate-600 cursor-not-allowed'
              }`}
            >
              {isOpsAdmin ? <Download className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
              <span>JSON</span>
            </button>
          </div>
        </div>
      </div>

      {/* Help Desk Persona Banner Notice */}
      {!isOpsAdmin && (
        <div className="rounded-lg bg-sky-950/40 border border-sky-800/60 p-3 flex items-center justify-between text-xs text-sky-200">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0" />
            <span>
              <strong>Help Desk Mode Active:</strong> Client IP addresses are masked (e.g. 192.168.***.***) to preserve user privacy under AES v3 guidelines. Session eviction and raw data export are disabled.
            </span>
          </div>
          <span className="font-mono text-[11px] text-sky-400 bg-sky-900/60 px-2 py-0.5 rounded border border-sky-700/60">
            helpdesk_viewer
          </span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {statusTabs.map((tab) => {
            const isSelected = statusFilter === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  isSelected
                    ? 'bg-slate-800 text-white font-semibold border border-slate-700 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <span>{tab.label}</span>
                {typeof tab.count === 'number' && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      isSelected
                        ? 'bg-brand-600 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <span className="text-xs text-slate-500 font-mono hidden sm:inline">
          Showing {sessions.length} sessions
        </span>
      </div>

      {/* Main Table Grid */}
      <SessionGrid
        sessions={sessions}
        isLoading={isLoading}
        isColdQueryLoading={isFetching && !isLoading}
        isOlderHistoricalEmpty={isOlderHistoricalEmpty}
        indexErrorUrl={indexErrorUrl}
        onResetRange={() => setDateRange('7d')}
        onDisconnect={disconnectSession}
      />

      {hasMore && (
        <div className="flex justify-center pt-2">
          <button
            onClick={loadMore}
            disabled={isFetchingNextPage}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-sm"
          >
            {isFetchingNextPage ? (
              <>
                <span className="w-3 h-3 rounded-full border-2 border-brand-400 border-t-transparent animate-spin mr-1" />
                <span>Loading older sessions...</span>
              </>
            ) : (
              <span>Load More (Next Cursor Page)</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
