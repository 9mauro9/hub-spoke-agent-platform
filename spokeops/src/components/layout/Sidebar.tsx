import React from 'react';
import {
  Activity,
  Users,
  ShieldCheck,
  Layers,
  Terminal,
  Server,
  Radio,
  ExternalLink
} from 'lucide-react';
import { useSessions } from '../../hooks/useSessions';
import { useAuditLogs } from '../../hooks/useAuditLogs';
import { Badge } from '../common/Badge';

export interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPath, onNavigate }) => {
  const { activeCount } = useSessions();
  const { deniedCount } = useAuditLogs();

  const navItems = [
    {
      label: 'Dashboard',
      path: '/',
      icon: Activity
    },
    {
      label: 'Live Sessions',
      path: '/sessions',
      icon: Users,
      badge: activeCount > 0 ? `${activeCount} live` : undefined,
      badgeVariant: 'success' as const,
      pulse: activeCount > 0
    },
    {
      label: 'Audit Explorer',
      path: '/audit',
      icon: ShieldCheck,
      badge: deniedCount > 0 ? `${deniedCount} alert` : undefined,
      badgeVariant: 'danger' as const
    },
    {
      label: 'Tenant Registry',
      path: '/tenants',
      icon: Layers
    }
  ];

  return (
    <aside className="w-64 border-r border-slate-800/90 bg-slate-950 flex flex-col justify-between shrink-0 h-screen sticky top-0">
      {/* Brand Header */}
      <div>
        <div className="p-4 border-b border-slate-800/90 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-brand-600 to-sky-400 flex items-center justify-center text-white shadow-lg shadow-brand-500/20">
            <Radio className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-base tracking-tight text-white">SpokeOps</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-brand-950 text-brand-400 border border-brand-800/80">
                Hub-Spoke
              </span>
            </div>
            <p className="text-[11px] text-slate-400 tracking-tight">Telemetry & RBAC Platform</p>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="p-3 space-y-1">
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 font-mono">
            Platform Observability
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.path;

            return (
              <button
                key={item.path}
                onClick={() => onNavigate(item.path)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-slate-900 text-white font-semibold shadow-sm border border-slate-800'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-brand-400' : 'text-slate-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <Badge
                    variant={item.badgeVariant || 'neutral'}
                    size="xs"
                    pulse={item.pulse}
                  >
                    {item.badge}
                  </Badge>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* System Status & Spoke Info */}
      <div className="p-3 border-t border-slate-800/80 space-y-2">
        <div className="rounded-lg bg-slate-900/80 border border-slate-800 p-3 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[11px]">Ingestion Node</span>
            <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Online (v2)
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[11px]">GCP Project</span>
            <span className="text-slate-300 font-mono text-[11px]">spokeops</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[11px]">Heartbeat Reap</span>
            <span className="text-slate-300 font-mono text-[11px]">360s</span>
          </div>
        </div>

        <div className="px-2 text-[10px] text-slate-400 flex items-center justify-between">
          <span>SpokeOps v1.0.0</span>
          <span>AES Standard</span>
        </div>
      </div>
    </aside>
  );
};
