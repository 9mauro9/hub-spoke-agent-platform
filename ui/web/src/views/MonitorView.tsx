import React, { useState } from "react";
import { usePlatform } from "../contexts/PlatformContext.tsx";
import { useHubStream } from "../hooks/useHubStream.ts";
import { LangGraphVisualizer } from "../components/execution/LangGraphVisualizer.tsx";
import { LogStreamDrawer } from "../components/execution/LogStreamDrawer.tsx";
import { HitlApprovalModal } from "../components/hitl/HitlApprovalModal.tsx";
import { Badge } from "../components/common/Badge.tsx";
import { Button } from "../components/common/Button.tsx";
import {
  Activity,
  Terminal,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Coins,
  Radio,
  FileCode,
} from "lucide-react";

export const MonitorView: React.FC = () => {
  const { activeSessionId, setActiveSessionId, sessions } = usePlatform();
  const [logDrawerOpen, setLogDrawerOpen] = useState(false);
  const [manualHitlOpen, setManualHitlOpen] = useState(false);

  const {
    events,
    activeNode,
    nodeStatuses,
    isHitlWaiting,
    hitlPayload,
    latestState,
    streamConnected,
    accumulatedTokens,
  } = useHubStream(activeSessionId);

  const currentSessionMeta = sessions.find((s) => s.sessionId === activeSessionId);

  return (
    <div className="space-y-6">
      {/* Top Session Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-100 font-mono">
                Session: {activeSessionId || "No active session"}
              </h3>
              {streamConnected && (
                <Badge variant="success" pulse icon={<Radio className="w-3 h-3" />}>
                  Live Stream
                </Badge>
              )}
            </div>
            <div className="text-xs text-slate-400 font-mono mt-0.5">
              Target: <span className="text-indigo-300">{currentSessionMeta?.targetSpoke || "spoke-housekeeper"}</span> | Action:{" "}
              <span className="text-slate-200">{currentSessionMeta?.action || "default"}</span>
            </div>
          </div>
        </div>

        {/* Session Selector & Logs Trigger */}
        <div className="flex items-center gap-3">
          {sessions.length > 0 && (
            <select
              value={activeSessionId || ""}
              onChange={(e) => setActiveSessionId(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
            >
              {sessions.map((s) => (
                <option key={s.sessionId} value={s.sessionId}>
                  {s.sessionId} ({s.targetSpoke} - {s.status})
                </option>
              ))}
            </select>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => setLogDrawerOpen(true)}
            icon={<Terminal className="w-4 h-4 text-indigo-400" />}
          >
            Live Logs ({events.length})
          </Button>

          {isHitlWaiting && (
            <Button
              size="sm"
              variant="danger"
              onClick={() => setManualHitlOpen(true)}
              icon={<AlertTriangle className="w-4 h-4 animate-bounce" />}
            >
              Review Gate
            </Button>
          )}
        </div>
      </div>

      {/* Live LangGraph Canvas */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-2">
            <span>LangGraph Deterministic Topology</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400 font-normal">Active Node:</span>
            <span className="text-indigo-400 font-bold">{activeNode || "idle"}</span>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Complete
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-ping" /> Executing
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> HITL Gate
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> Retry
            </span>
          </div>
        </div>

        <LangGraphVisualizer
          nodeStatuses={nodeStatuses}
          activeNode={activeNode}
          onNodeClick={(id) => {
            if (id === "hitl_approval_gate" && isHitlWaiting) {
              setManualHitlOpen(true);
            }
          }}
        />
      </div>

      {/* Real-time State & Telemetry Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Token Ticker */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 uppercase font-mono">Reconciled Tokens</div>
            <div className="text-lg font-bold font-mono text-indigo-400">
              {(accumulatedTokens || latestState?.reconciled_usage?.actual_tokens || 0).toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              Est: {(latestState?.cost_estimate?.estimated_total_tokens || 0).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Retries and Validation */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 uppercase font-mono">Retry Cycles (Max 3)</div>
            <div className="text-lg font-bold font-mono text-orange-400">
              {latestState?.retry_count || 0} / 3
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              Sliding context error compaction active
            </div>
          </div>
        </div>

        {/* Current State Outcome */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 uppercase font-mono">Workflow Status</div>
            <div className="text-lg font-bold font-mono text-emerald-400">
              {latestState?.status || currentSessionMeta?.status || "INITIALIZED"}
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              PAB: Verified
            </div>
          </div>
        </div>
      </div>

      {/* Structured Output & Modified Files Card */}
      {latestState?.spoke_response?.result_payload && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4 text-indigo-400" />
              <h4 className="text-sm font-bold text-slate-200 uppercase tracking-wider font-mono">
                Spoke Result Payload & Artifacts
              </h4>
            </div>
            {latestState.spoke_response.result_payload.storage_uri && (
              <Badge variant="purple">Artifact Stored in GCS</Badge>
            )}
          </div>

          {latestState.spoke_response.result_payload.storage_uri && (
            <div className="p-3 bg-indigo-950/30 border border-indigo-500/30 rounded-lg text-xs font-mono text-indigo-300 break-all select-all">
              {latestState.spoke_response.result_payload.storage_uri}
            </div>
          )}

          {latestState.spoke_response.result_payload.modified_files?.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs text-slate-400">Modified / Targeted Files:</div>
              <div className="flex flex-wrap gap-2">
                {latestState.spoke_response.result_payload.modified_files.map((f: string, i: number) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-slate-300 font-mono text-xs"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Slide-over Log Stream Drawer */}
      <LogStreamDrawer
        isOpen={logDrawerOpen}
        onClose={() => setLogDrawerOpen(false)}
        events={events}
        sessionId={activeSessionId}
        accumulatedTokens={accumulatedTokens}
      />

      {/* Human-in-the-Loop Gate Modal */}
      {activeSessionId && (
        <HitlApprovalModal
          isOpen={isHitlWaiting || manualHitlOpen}
          onClose={() => setManualHitlOpen(false)}
          sessionId={activeSessionId}
          payload={hitlPayload || { state: latestState }}
        />
      )}
    </div>
  );
};
