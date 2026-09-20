import React from 'react';
import { useSessions } from '../hooks/useSessions';
import { useAuditLogs } from '../hooks/useAuditLogs';
import { useTenantFilter } from '../context/TenantFilterContext';
import { Badge } from '../components/common/Badge';
import { SessionGrid } from '../components/sessions/SessionGrid';
import { AuditTable } from '../components/audit/AuditTable';
import {
  Users,
  ShieldAlert,
  AlertTriangle,
  Layers,
  ArrowUpRight,
  TrendingUp,
  Activity,
  CheckCircle2
} from 'lucide-react';

interface DashboardProps {
  onNavigate: (path: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { sessions, activeCount, idleCount, timedOutCount, isLoading: loadingSessions, disconnectSession } = useSessions();
  const { events, deniedCount, warningCount, isLoading: loadingEvents } = useAuditLogs();
  const { tenants, selectedTenantMeta } = useTenantFilter();

  const recentSessions = sessions.slice(0, 4);
  const recentEvents = events.slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Top Welcome & Subtitle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>Operations Telemetry Center</span>
            {selectedTenantMeta ? (
              <Badge variant="info" size="sm">
                {selectedTenantMeta.appName}
              </Badge>
            ) : (
              <Badge variant="neutral" size="sm">
                All Tenants
              </Badge>
            )}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time RBAC session observability and security audit ingestion across all initiatives.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('/sessions')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium shadow-md shadow-brand-600/20 transition-all"
          >
            <span>Live Presence</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onNavigate('/audit')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-all"
          >
            <span>Audit Stream</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Sessions */}
        <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-4 relative overflow-hidden backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
              Active Sessions
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-800/80 flex items-center justify-center text-emerald-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white tracking-tight">
              {activeCount}
            </span>
            <span className="text-xs text-emerald-400 flex items-center font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1" />
              Live Presence
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Idle: {idleCount}</span>
            <span>Timed out: {timedOutCount}</span>
          </div>
        </div>

        {/* Security Denials */}
        <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-4 relative overflow-hidden backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
              Access Denied
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-950/80 border border-rose-800/80 flex items-center justify-center text-rose-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white tracking-tight">
              {deniedCount}
            </span>
            <span className="text-xs text-rose-400 font-medium">RBAC Violations</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            {deniedCount > 0 ? 'Requires administrative review' : 'No recent violations'}
          </div>
        </div>

        {/* Warning Alerts */}
        <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-4 relative overflow-hidden backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
              System Warnings
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-950/80 border border-amber-800/80 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white tracking-tight">
              {warningCount}
            </span>
            <span className="text-xs text-amber-400 font-medium">Schedule / Roles</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            Resource conflict warnings
          </div>
        </div>

        {/* Registered Tenants */}
        <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-4 relative overflow-hidden backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
              Connected Spokes
            </span>
            <div className="w-8 h-8 rounded-lg bg-sky-950/80 border border-sky-800/80 flex items-center justify-center text-sky-400">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white tracking-tight">
              {tenants.length}
            </span>
            <span className="text-xs text-sky-400 font-medium">Active Tenants</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            Academy Apps & Avventiq
          </div>
        </div>
      </div>

      {/* Connected Tenants Health Strip */}
      <div className="rounded-xl bg-slate-900/60 border border-slate-800/80 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-brand-400" />
            Spoke Telemetry Health Grid
          </h2>
          <button
            onClick={() => onNavigate('/tenants')}
            className="text-xs text-brand-400 hover:text-brand-300 font-medium"
          >
            Manage Registry &rarr;
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {tenants.map((tenant) => {
            const tenantSessions = sessions.filter((s) => s.appId === tenant.appId && s.status === 'active').length;
            return (
              <div
                key={tenant.appId}
                className="rounded-lg bg-slate-950/80 border border-slate-800/90 p-3 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-slate-200">{tenant.appName}</span>
                  <Badge variant={tenant.environment === 'production' ? 'success' : 'info'} size="xs">
                    {tenant.environment}
                  </Badge>
                </div>
                <div className="mt-2 text-[11px] text-slate-500 font-mono">
                  appId: <span className="text-slate-400">{tenant.appId}</span>
                </div>
                <div className="mt-2 flex items-center justify-between pt-2 border-t border-slate-800/60 text-[11px]">
                  <span className="text-slate-400">Live sessions:</span>
                  <span className="font-mono text-emerald-400 font-semibold">{tenantSessions}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Sessions Quick View */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white tracking-tight">
              Live Presence Overview
            </h2>
            <p className="text-xs text-slate-400">
              Users currently active across spoke applications.
            </p>
          </div>
          <button
            onClick={() => onNavigate('/sessions')}
            className="text-xs font-medium text-brand-400 hover:text-brand-300 flex items-center gap-1"
          >
            View all ({sessions.length}) &rarr;
          </button>
        </div>

        <SessionGrid
          sessions={recentSessions}
          isLoading={loadingSessions}
          onDisconnect={disconnectSession}
        />
      </div>

      {/* Recent Security & Audit Events */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white tracking-tight">
              Recent Audit & Security Events
            </h2>
            <p className="text-xs text-slate-400">
              Access grants, modifications, and permission denial logs.
            </p>
          </div>
          <button
            onClick={() => onNavigate('/audit')}
            className="text-xs font-medium text-brand-400 hover:text-brand-300 flex items-center gap-1"
          >
            Open Explorer ({events.length}) &rarr;
          </button>
        </div>

        <AuditTable events={recentEvents} isLoading={loadingEvents} />
      </div>
    </div>
  );
};
