import React, { useState } from 'react';
import { useAuditLogs } from '../hooks/useAuditLogs';
import { useAuth } from '../context/AuthContext';
import { useTenantFilter } from '../context/TenantFilterContext';
import { AuditTable } from '../components/audit/AuditTable';
import { AuditSeverity, AuditAction } from '../types/telemetry';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Download,
  Filter,
  Lock,
  FileJson,
  CheckCircle2
} from 'lucide-react';

export const AuditExplorer: React.FC = () => {
  const [severityFilter, setSeverityFilter] = useState<AuditSeverity | 'all'>('all');
  const [actionFilter, setActionFilter] = useState<AuditAction | 'all'>('all');

  const {
    events,
    deniedCount,
    warningCount,
    successCount,
    isLoading,
    isFetching,
    loadMore,
    hasMore,
    isFetchingNextPage,
    isOlderHistoricalEmpty,
    indexErrorUrl
  } = useAuditLogs({
    severityFilter,
    actionFilter
  });
  const { isOpsAdmin } = useAuth();
  const { selectedTenantMeta, setDateRange } = useTenantFilter();
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const severityTabs: { label: string; value: AuditSeverity | 'all'; count?: number; color?: string }[] = [
    { label: 'All Severities', value: 'all' },
    { label: 'Success', value: 'success', count: successCount },
    { label: 'Warnings', value: 'warning', count: warningCount },
    { label: 'Denied (Alerts)', value: 'denied', count: deniedCount }
  ];

  const actionOptions: { label: string; value: AuditAction | 'all' }[] = [
    { label: 'All Actions', value: 'all' },
    { label: 'Agent Task Started', value: 'agent_task_started' },
    { label: 'Agent Task Executed', value: 'agent_task_executed' },
    { label: 'Agent Task Failed', value: 'agent_task_failed' },
    { label: 'Policy Update', value: 'policy_update' },
    { label: 'Permission Denied', value: 'permission_denied' },
    { label: 'Role Grant', value: 'role_grant' },
    { label: 'Role Revoke', value: 'role_revoke' },
    { label: 'Resource Update', value: 'resource_update' },
    { label: 'Resource Create', value: 'resource_create' },
    { label: 'Resource Delete', value: 'resource_delete' },
    { label: 'Login', value: 'login' },
    { label: 'Logout', value: 'logout' }
  ];

  const handleExportJSON = () => {
    if (!isOpsAdmin) {
      setExportNotice('Audit log exports are restricted to Ops Administrators.');
      setTimeout(() => setExportNotice(null), 4000);
      return;
    }

    const jsonContent = JSON.stringify(events, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `spokeops_audit_events_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-brand-400" />
            <span>Audit Log Explorer</span>
            {selectedTenantMeta && (
              <span className="text-xs font-mono text-slate-400 font-normal">
                ({selectedTenantMeta.appName})
              </span>
            )}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Immutable chronicle of RBAC permission checks, policy decisions, and state mutations.
          </p>
        </div>

        {/* Export & Actions */}
        <div className="flex items-center gap-2">
          {exportNotice && (
            <span className="text-xs text-amber-400 bg-amber-950/80 border border-amber-800/80 px-2.5 py-1 rounded-md flex items-center gap-1.5 animate-in fade-in duration-150">
              <AlertTriangle className="w-3.5 h-3.5" />
              {exportNotice}
            </span>
          )}

          <button
            onClick={handleExportJSON}
            title={isOpsAdmin ? 'Export filtered audit logs as JSON' : 'Export restricted to Ops Admin'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
              isOpsAdmin
                ? 'bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800 hover:text-white'
                : 'bg-slate-900/50 border-slate-800/50 text-slate-600 cursor-not-allowed'
            }`}
          >
            {isOpsAdmin ? <Download className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5 text-slate-600" />}
            <span>Export Audit Log</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        {/* Severity Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {severityTabs.map((tab) => {
            const isSelected = severityFilter === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setSeverityFilter(tab.value)}
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
                      tab.value === 'denied' && tab.count > 0
                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                        : isSelected
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

        {/* Action Type Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-mono flex items-center gap-1">
            <Filter className="w-3 h-3 text-slate-400" />
            Action:
          </span>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value as AuditAction | 'all')}
            className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-brand-500 cursor-pointer"
          >
            {actionOptions.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-slate-900 text-slate-200">
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Table */}
      <AuditTable
        events={events}
        isLoading={isLoading}
        isColdQueryLoading={isFetching && !isLoading}
        isOlderHistoricalEmpty={isOlderHistoricalEmpty}
        indexErrorUrl={indexErrorUrl}
        onResetRange={() => setDateRange('7d')}
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
                <span>Loading older records...</span>
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
