import React from 'react';
import { SessionDoc } from '../../types/telemetry';
import { Modal } from '../common/Modal';
import { Badge } from '../common/Badge';
import { SessionDurationCounter } from './SessionDurationCounter';
import { useAuth } from '../../context/AuthContext';
import { Globe, Monitor, Smartphone, Clock, Shield, User, HardDrive } from 'lucide-react';

interface SessionDetailModalProps {
  session: SessionDoc | null;
  isOpen: boolean;
  onClose: () => void;
  onDisconnect?: (sessionId: string) => void;
}

export const SessionDetailModal: React.FC<SessionDetailModalProps> = ({
  session,
  isOpen,
  onClose,
  onDisconnect
}) => {
  const { isOpsAdmin, maskIpAddress } = useAuth();

  if (!session) return null;

  const statusVariantMap = {
    active: 'success' as const,
    idle: 'warning' as const,
    timed_out: 'neutral' as const,
    closed: 'neutral' as const
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Session Telemetry: ${session.sessionId}`}
      subtitle={`Application: ${session.appId} | Status: ${session.status.toUpperCase()}`}
      maxWidth="lg"
    >
      <div className="space-y-4 text-xs">
        {/* User Identity & RBAC Header */}
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-brand-950 border border-brand-800 text-brand-400 flex items-center justify-center font-bold">
              <User className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-slate-200">{session.userEmail}</div>
              <div className="text-slate-500 font-mono text-[11px]">{session.userId}</div>
            </div>
          </div>
          <Badge
            variant={statusVariantMap[session.status]}
            pulse={session.status === 'active'}
          >
            {session.status}
          </Badge>
        </div>

        {/* Assigned RBAC Roles */}
        <div>
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-brand-400" />
            Active RBAC Roles ({session.userRoles.length})
          </div>
          <div className="flex flex-wrap gap-1.5 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
            {session.userRoles.map((role) => (
              <Badge key={role} variant="purple" size="xs">
                {role}
              </Badge>
            ))}
          </div>
        </div>

        {/* Client Metadata Breakdown */}
        <div>
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Monitor className="w-3.5 h-3.5 text-sky-400" />
            Client Environment & Device Telemetry
          </div>
          <div className="grid grid-cols-2 gap-2 bg-slate-950 p-3 rounded-lg border border-slate-800">
            <div>
              <span className="text-slate-500 block text-[11px]">Browser & Engine</span>
              <span className="text-slate-200 font-medium">{session.clientMetadata.browser}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Operating System</span>
              <span className="text-slate-200 font-medium">{session.clientMetadata.os}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">IP Address</span>
              <span className="text-slate-200 font-mono">
                {maskIpAddress(session.clientMetadata.ipAddress)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Viewport Resolution</span>
              <span className="text-slate-200 font-mono">{session.clientMetadata.viewport}</span>
            </div>
          </div>
        </div>

        {/* Session Cadence & Timestamps */}
        <div>
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            Cadence & Lifespan
          </div>
          <div className="grid grid-cols-3 gap-2 bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[11px]">
            <div>
              <span className="text-slate-500 block text-[10px]">Session Start</span>
              <span className="text-slate-300">{new Date(session.startedAt).toLocaleTimeString()}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Last Heartbeat</span>
              <span className="text-slate-300">{new Date(session.lastHeartbeat).toLocaleTimeString()}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Total Duration</span>
              <SessionDurationCounter
                startedAt={session.startedAt}
                initialDurationSeconds={session.durationSeconds}
                status={session.status}
              />
            </div>
          </div>
        </div>

        {/* Raw User-Agent */}
        <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono text-[10px] text-slate-400 break-all">
          <span className="text-slate-500 block mb-0.5">Raw User-Agent Header:</span>
          {session.clientMetadata.userAgent}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
          >
            Close
          </button>

          {session.status !== 'closed' && (
            <div className="flex items-center gap-2">
              {!isOpsAdmin && (
                <span className="text-[11px] text-amber-400 font-mono">
                  [Eviction Restricted to Ops Admin]
                </span>
              )}
              <button
                disabled={!isOpsAdmin}
                onClick={() => {
                  if (onDisconnect) {
                    onDisconnect(session.sessionId);
                    onClose();
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isOpsAdmin
                    ? 'bg-rose-950 text-rose-300 border border-rose-800 hover:bg-rose-900 shadow-sm'
                    : 'bg-slate-800/60 text-slate-600 border border-slate-800 cursor-not-allowed'
                }`}
              >
                Disconnect Session
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
