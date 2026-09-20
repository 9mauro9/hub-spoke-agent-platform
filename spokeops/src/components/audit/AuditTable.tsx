import React, { useState } from 'react';
import { AuditEventDoc } from '../../types/telemetry';
import { DataTable, Column } from '../common/DataTable';
import { SeverityBadge } from './SeverityBadge';
import { Badge } from '../common/Badge';
import { JsonInspectorDrawer } from './JsonInspectorDrawer';
import { Code, Eye } from 'lucide-react';

interface AuditTableProps {
  events: AuditEventDoc[];
  isLoading?: boolean;
}

export const AuditTable: React.FC<AuditTableProps> = ({ events, isLoading = false }) => {
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

  return (
    <>
      <DataTable
        data={events}
        columns={columns}
        keyExtractor={(item) => item.eventId}
        isLoading={isLoading}
        onRowClick={(item) => setSelectedEvent(item)}
        emptyTitle="No audit records match criteria"
        emptyDescription="Audit records will be recorded in real-time as users execute actions across Spoke applications."
      />

      <JsonInspectorDrawer
        event={selectedEvent}
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </>
  );
};
