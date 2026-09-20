import React, { useState } from 'react';
import { useTenantFilter } from '../context/TenantFilterContext';
import { Badge } from '../components/common/Badge';
import {
  Layers,
  Shield,
  KeyRound,
  Globe,
  CheckCircle2,
  Copy,
  Check,
  Code,
  Terminal,
  ExternalLink
} from 'lucide-react';

export const Tenants: React.FC = () => {
  const { tenants, isLoadingTenants } = useTenantFilter();
  const [copiedAppId, setCopiedAppId] = useState<string | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  const handleCopyHash = (appId: string, hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedAppId(appId);
    setTimeout(() => setCopiedAppId(null), 2000);
  };

  const sampleSnippet = `// 1. Install or import the SpokeOps telemetry SDK in your spoke app
import { initSpokeOps, logAuditEvent } from '@spokeops/telemetry';

// 2. Initialize during app bootstrap
initSpokeOps({
  appId: 'academy-library',
  spokeToken: process.env.SPOKEOPS_TOKEN,
  endpointUrl: 'https://spokeops-ingestion-541312712358.us-central1.run.app/api/v1/telemetry',
  user: {
    userId: currentUser.id,
    email: currentUser.email,
    roles: currentUser.rbacRoles
  },
  environment: 'production'
});

// 3. Log RBAC-governed audit events anywhere in your business logic
logAuditEvent({
  action: 'resource_update',
  resourceType: 'curriculum_module',
  resourceId: 'mod_quantum_101',
  status: 'success',
  metadata: {
    moduleName: 'Advanced Quantum Mechanics',
    changeType: 'syllabus_revision'
  }
});`;

  const handleCopySnippet = () => {
    navigator.clipboard.writeText(sampleSnippet);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <Layers className="w-5 h-5 text-brand-400" />
          <span>Tenant Registry & Spoke Configuration</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Registered applications authorized to ingest telemetry and emit audit events under AES v3 specifications.
        </p>
      </div>

      {/* Tenant Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tenants.map((t) => (
          <div
            key={t.appId}
            className="rounded-xl bg-slate-900/80 border border-slate-800 p-5 space-y-4 hover:border-slate-700 transition-colors"
          >
            {/* Top info */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">{t.appName}</h3>
                <span className="text-xs font-mono text-brand-400">{t.appId}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge
                  variant={t.environment === 'production' ? 'success' : 'info'}
                  size="xs"
                >
                  {t.environment}
                </Badge>
                <Badge variant={t.isActive ? 'success' : 'danger'} size="xs">
                  {t.isActive ? 'ACTIVE' : 'INACTIVE'}
                </Badge>
              </div>
            </div>

            {/* Allowed Origins */}
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
                <Globe className="w-3 h-3 text-slate-400" />
                Allowed CORS Origins
              </span>
              <div className="flex flex-wrap gap-1.5">
                {t.allowedOrigins.map((origin) => (
                  <span
                    key={origin}
                    className="font-mono text-[11px] bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-slate-300"
                  >
                    {origin}
                  </span>
                ))}
              </div>
            </div>

            {/* Token Hash */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <KeyRound className="w-3 h-3 text-brand-400" />
                  Spoke Token SHA-256 Digest
                </span>
                <button
                  onClick={() => handleCopyHash(t.appId, t.spokeTokenHash)}
                  className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
                >
                  {copiedAppId === t.appId ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Digest</span>
                    </>
                  )}
                </button>
              </div>
              <div className="font-mono text-[11px] bg-slate-950 p-2 rounded-lg border border-slate-800 text-slate-400 truncate select-all">
                {t.spokeTokenHash}
              </div>
            </div>

            {/* Registration Date */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 font-mono">
              <span>Registered:</span>
              <span>{new Date(t.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Integration Code Snippet */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-brand-400" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300 font-mono">
              Spoke Application Integration Guide (@spokeops/telemetry)
            </h2>
          </div>
          <button
            onClick={handleCopySnippet}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
          >
            {copiedSnippet ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied snippet</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copy Code</span>
              </>
            )}
          </button>
        </div>

        <pre className="p-4 text-xs font-mono text-sky-300 bg-slate-950 overflow-x-auto leading-relaxed">
          {sampleSnippet}
        </pre>
      </div>
    </div>
  );
};
