import React, { useState } from 'react';
import { AuditEventDoc } from '../../types/telemetry';
import { DataTable, Column } from '../common/DataTable';
import { SeverityBadge } from './SeverityBadge';
import { Badge } from '../common/Badge';
import { JsonInspectorDrawer } from './JsonInspectorDrawer';
import { Code, Eye, AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react';

interface AuditTableProps {
  events: AuditEventDoc[];
  isLoading?: boolean;
  isColdQueryLoading?: boolean;
  isOlderHistoricalEmpty?: boolean;
  indexErrorUrl?: string | null;
  onResetRange?: () => void;
}

export const AuditTable: React.FC<AuditTableProps> = ({
  events,
  isLoading = false,
  isColdQueryLoading = false,
  isOlderHistoricalEmpty = false,
  indexErrorUrl = null,
  onResetRange
}) => {
  const [selectedEvent, setSelectedEvent] = useState<AuditEventDoc | null>(null);

  const actionVariantMap: Record<string, 'neutral' | 'info' | 'purple' | 'danger'> = {
    login: 'info',
    logout: 'neutral',
    role_grant: 'purple',
    role_revoke: 'danger',
    resource_create: 'info',
    resource_update: 'neutral',
    resource_delete: 'danger',
    permission_denied: 'danger'
  };

  const columns: Column<AuditEventDoc>[] = [
    {
      header: 'Severity',
      className: 'w-24',
      cell: (item) => <SeverityBadge status={item.status} />
    },
    {
      header: 'Timestamp',
      className: 'w-36 font-mono text-slate-400 text-[11px]',
      cell: (item) => new Date(item.timestamp).toLocaleString()
    },
    {
      header: 'Action',
      cell: (item) => (
        <Badge
          variant={actionVariantMap[item.action] || 'neutral'}
          size="xs"
        >
          {item.action.replace('_', ' ')}
        </Badge>
      )
    },
    {
      header: 'User & Role',
      cell: (item) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-200">{item.userEmail}</span>
          <span className="text-[11px] text-slate-500 font-mono">
            role: <span className="text-purple-400">{item.roleAtExecution}</span>
          </span>
        </div>
      )
    },
    {
      header: 'Target Resource',
      cell: (item) => (
        <div className="flex flex-col font-mono text-[11px]">
          <span className="text-brand-400 font-medium">{item.resourceType}</span>
          <span className="text-slate-400">{item.resourceId}</span>
        </div>
      )
    },
    {
      header: 'Tenant',
      className: 'font-mono text-[11px] text-slate-400',
      cell: (item) => item.appId
    },
    {
      header: 'Payload',
      className: 'text-right w-20',
      cell: (item) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedEvent(item);
          }}
          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors text-[11px] font-medium"
        >
          <Code className="w-3 h-3 text-brand-400" />
          <span>JSON</span>
        </button>
      )
    }
  ];

  const emptyTitle = isOlderHistoricalEmpty
    ? 'No transactions older than 7 days'
    : 'No audit records match criteria';

  const emptyDescription = isOlderHistoricalEmpty
    ? 'Zero audit records older than 7 days exist for this spoke. Telemetry retention or active transactions may be focused within the recent 7-day operational window.'
    : 'Audit records will be recorded in real-time as users execute actions across Spoke applications.';

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
        data={events}
        columns={columns}
        keyExtractor={(item) => item.eventId}
        isLoading={isLoading}
        isColdQueryLoading={isColdQueryLoading}
        onRowClick={(item) => setSelectedEvent(item)}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        emptyAction={emptyAction}
      />

      <JsonInspectorDrawer
        event={selectedEvent}
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </>
  );
};
