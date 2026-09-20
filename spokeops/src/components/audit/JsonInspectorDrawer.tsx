import React, { useState } from 'react';
import { AuditEventDoc } from '../../types/telemetry';
import { SeverityBadge } from './SeverityBadge';
import { Badge } from '../common/Badge';
import { X, Copy, Check, Code, Shield, Clock, ExternalLink } from 'lucide-react';

interface JsonInspectorDrawerProps {
  event: AuditEventDoc | null;
  isOpen: boolean;
  onClose: () => void;
}

export const JsonInspectorDrawer: React.FC<JsonInspectorDrawerProps> = ({
  event,
  isOpen,
  onClose
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !event) return null;

  const jsonString = JSON.stringify(event.metadata, null, 2);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy JSON:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop (semi-transparent to preserve context of the table behind it) */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px] transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-xl bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-250 ease-out text-slate-100">
          {/* Header */}
          <div className="p-4 border-b border-slate-800 flex items-start justify-between bg-slate-950/80">
            <div>
              <div className="flex items-center gap-2">
                <SeverityBadge status={event.status} />
                <span className="font-mono text-xs text-slate-400">{event.eventId}</span>
              </div>
              <h2 className="text-base font-semibold text-white mt-1 capitalize">
                {event.action.replace('_', ' ')}: <span className="font-mono text-sm text-brand-400">{event.resourceType}</span>
              </h2>
              <div className="text-xs text-slate-400 mt-0.5">
                Target Resource: <span className="font-mono text-slate-200">{event.resourceId}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
            {/* Event Overview Metadata */}
            <div className="grid grid-cols-2 gap-2 bg-slate-950 p-3 rounded-lg border border-slate-800">
              <div>
                <span className="text-slate-500 block text-[11px]">Tenant / App</span>
                <span className="text-brand-400 font-semibold font-mono">{event.appId}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Timestamp</span>
                <span className="text-slate-300 font-mono">
                  {new Date(event.timestamp).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Executing User</span>
                <span className="text-slate-200 font-medium">{event.userEmail}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Role At Execution</span>
                <Badge variant="purple" size="xs">
                  {event.roleAtExecution}
                </Badge>
              </div>
            </div>

            {/* Session Association */}
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-slate-500 block text-[11px]">Origin Session</span>
                <span className="text-slate-300 font-mono">{event.sessionId}</span>
              </div>
              <Badge variant="neutral" size="xs">
                Linked Session
              </Badge>
            </div>

            {/* JSON Metadata Payload Title & Copy */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-1.5 font-semibold text-slate-300 uppercase tracking-wider text-[11px]">
                <Code className="w-3.5 h-3.5 text-brand-400" />
                Sanitized Payload Metadata (OWASP Compliant)
              </div>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors text-[11px] font-medium"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-slate-400" />
                    <span>Copy JSON</span>
                  </>
                )}
              </button>
            </div>

            {/* Code Viewer */}
            <div className="relative rounded-lg overflow-hidden border border-slate-800 bg-slate-950">
              <div className="px-3 py-1.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span>metadata.json</span>
                <span>{Object.keys(event.metadata || {}).length} keys</span>
              </div>
              <pre className="p-4 text-[11px] font-mono text-sky-300 overflow-x-auto leading-relaxed max-h-[380px]">
                {jsonString}
              </pre>
            </div>

            <div className="rounded-lg bg-sky-950/30 border border-sky-800/40 p-3 text-[11px] text-sky-300">
              <span className="font-semibold block mb-0.5">AES v3 PII Protection Active</span>
              All credentials, authorization tokens, passwords, and sensitive keys have been scrubbed by the SpokeOps ingestion firewall prior to persistence.
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs transition-colors"
            >
              Close Drawer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
