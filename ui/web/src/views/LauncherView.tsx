import React, { useState, useEffect } from "react";
import { usePlatform } from "../contexts/PlatformContext.tsx";
import { CostEstimatorCard } from "../components/finops/CostEstimatorCard.tsx";
import { Button } from "../components/common/Button.tsx";
import { Badge } from "../components/common/Badge.tsx";
import { api } from "../api/client.ts";
import { CostEstimate, AgentTaskRequest } from "../api/schemas.ts";
import { useAuth } from "../context/AuthContext.tsx";
import { spokeOps } from "@/telemetry/spokeOpsClient.ts";
import {
  Rocket,
  Wrench,
  Video,
} from "lucide-react";

interface LauncherViewProps {
  onTaskDispatched: (sessionId: string) => void;
}

export const LauncherView: React.FC<LauncherViewProps> = ({ onTaskDispatched }) => {
  const { addSession, emergencyCircuitBreakerActive } = usePlatform();
  const { checkPermission } = useAuth();

  // Form state
  const [targetSpoke, setTargetSpoke] = useState<string>("spoke-housekeeper");
  const [action, setAction] = useState<string>("clean_repo_noise");
  const [sourceApp, setSourceApp] = useState<"academy-apps" | "avventiq" | "core-hub">("core-hub");
  const [repository, setRepository] = useState<string>(".");
  const [targetFiles, setTargetFiles] = useState<string[]>(["hub/app/main.py"]);

  // Housekeeper options
  const [dryRun, setDryRun] = useState<boolean>(true);
  const [cleanTempFiles, setCleanTempFiles] = useState<boolean>(true);
  const [auditMarkdown, setAuditMarkdown] = useState<boolean>(false);
  const [validateFirestore, setValidateFirestore] = useState<boolean>(false);
  const [hitlRequired, setHitlRequired] = useState<boolean>(false);

  // Video Ingest options
  const [videoUrl, setVideoUrl] = useState<string>("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  const [researchFocus, setResearchFocus] = useState<string>("End-to-End System Architecture, Firestore schemas, and API contracts");
  const [videoDurationSeconds, setVideoDurationSeconds] = useState<number>(1800);

  // Estimation state
  const [estimate, setEstimate] = useState<CostEstimate | null>(null);
  const [estimating, setEstimating] = useState<boolean>(false);
  const [dispatching, setDispatching] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Automatically fetch estimate whenever relevant parameters change
  useEffect(() => {
    let isMounted = true;
    const fetchEstimate = async () => {
      setEstimating(true);
      setErrorMsg(null);
      try {
        const est = await api.estimateTask({
          target_spoke: targetSpoke,
          action,
          target_files: targetSpoke === "spoke-video-ingest" ? ["video_research_compilation.md"] : targetFiles,
          repository,
          model_name: "gemini-1.5-flash",
          task_prompt_length: targetSpoke === "spoke-video-ingest" ? 12000 : 800,
        });
        if (isMounted) {
          setEstimate(est);
        }
      } catch (err: any) {
        if (isMounted) {
          console.warn("Estimation notice:", err);
        }
      } finally {
        if (isMounted) setEstimating(false);
      }
    };

    const timer = setTimeout(fetchEstimate, 400);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [targetSpoke, action, repository, targetFiles, videoUrl, researchFocus]);

  const handleSpokeSelect = (spokeId: string) => {
    setTargetSpoke(spokeId);
    if (spokeId === "spoke-housekeeper") {
      setAction("clean_repo_noise");
      setRepository(".");
      setTargetFiles(["hub/app/main.py"]);
    } else if (spokeId === "spoke-video-ingest") {
      setAction("parse_video_research");
      setRepository("video-stream");
      setTargetFiles(["research_compilation.md"]);
    }
  };

  const handleDispatch = async () => {
    setDispatching(true);
    setErrorMsg(null);

    // Step 2.3 of directive: Check RBAC permission for task dispatch
    if (!checkPermission("operator", "/launcher/dispatch")) {
      setErrorMsg("Permission Denied: Current RBAC role does not have dispatch privileges. Switch to 'Operator' or 'Admin' in the top bar.");
      setDispatching(false);
      return;
    }

    const sessionId = `ui-sess-${crypto.randomUUID().slice(0, 8)}`;
    const traceId = crypto.randomUUID();

    try {
      const contextMetadata: Record<string, any> = {
        hitl_required: hitlRequired,
      };

      if (targetSpoke === "spoke-housekeeper") {
        contextMetadata["dry_run"] = dryRun;
        contextMetadata["clean_temp_files"] = cleanTempFiles;
        contextMetadata["audit_markdown"] = auditMarkdown;
        contextMetadata["validate_firestore"] = validateFirestore;
        if (action === "audit_markdown_and_schemas") {
          contextMetadata["schemas_dir"] = "config/schemas";
        }
        if (action === "validate_firestore_rules_and_indexes") {
          contextMetadata["rules_file"] = "firestore.rules";
          contextMetadata["indexes_file"] = "firestore.indexes.json";
        }
      } else if (targetSpoke === "spoke-video-ingest") {
        contextMetadata["research_focus"] = researchFocus;
        contextMetadata["video_duration_seconds"] = videoDurationSeconds;
      }

      const taskRequest: AgentTaskRequest = {
        trace_id: traceId,
        session_id: sessionId,
        source_app: sourceApp,
        target_spoke: targetSpoke,
        action: action,
        payload: {
          repository: targetSpoke === "spoke-video-ingest" ? videoUrl : repository,
          branch: "main",
          target_files: targetFiles,
          storage_uri: targetSpoke === "spoke-video-ingest" ? videoUrl : undefined,
          context_metadata: contextMetadata,
        },
      };

      const res = await api.dispatchTask(taskRequest, "async");

      addSession({
        sessionId: res.session_id,
        traceId: res.trace_id,
        targetSpoke: targetSpoke,
        action: action,
        status: res.status,
        startTime: Date.now(),
      });

      // Step 2.1 of directive: Emit agent_task_started audit event
      const promptText = targetSpoke === "spoke-video-ingest" ? researchFocus : `${action} on ${repository}`;
      spokeOps.logAudit({
        action: "agent_task_started",
        resourceType: "agent_workflow",
        resourceId: res.session_id,
        status: "success",
        metadata: {
          promptLength: promptText.length,
          targetAgent: targetSpoke,
          action: action,
          sourceApp: sourceApp,
          repository: repository,
        },
      });

      onTaskDispatched(res.session_id);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to dispatch agent task");
      setDispatching(false);

      // Step 2 of directive: Emit agent_task_failed audit event
      spokeOps.logAudit({
        action: "agent_task_failed",
        resourceType: "agent_workflow",
        resourceId: sessionId,
        status: "warning",
        metadata: {
          error: err.message || "Failed to dispatch agent task",
          targetAgent: targetSpoke,
          action: action,
        },
      });
    }
  };

  const canExecute =
    !emergencyCircuitBreakerActive &&
    !dispatching &&
    estimate !== null &&
    !estimate.exceeds_threshold;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Title Banner */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
            <Rocket className="w-6 h-6 text-indigo-400" />
            Task Dispatcher & Orchestration Wizard
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Dispatch autonomous multi-agent workloads to registered Spokes without touching the terminal.
          </p>
        </div>
        <Badge variant="purple" className="font-mono">
          AES v3 Standard
        </Badge>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-950/40 border border-rose-500 rounded-xl text-xs text-rose-300">
          {errorMsg}
        </div>
      )}

      {/* Step 1: Spoke Selection Cards */}
      <div className="space-y-3">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
          Step 1: Select Target Spoke Worker
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Spoke Housekeeper Card */}
          <div
            onClick={() => handleSpokeSelect("spoke-housekeeper")}
            className={`p-5 rounded-xl border cursor-pointer transition-all ${
              targetSpoke === "spoke-housekeeper"
                ? "bg-indigo-950/30 border-indigo-500 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500"
                : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-100">Spoke Housekeeper</h4>
                  <div className="text-[11px] font-mono text-slate-400">spoke-housekeeper</div>
                </div>
              </div>
              <Badge variant="success">Active</Badge>
            </div>
            <p className="text-xs text-slate-300 mt-2">
              Repository hygiene, temporary artifact cleanup, documentation link audits, and Firestore security rules & indexes validation.
            </p>
          </div>

          {/* Spoke Video Ingest Card */}
          <div
            onClick={() => handleSpokeSelect("spoke-video-ingest")}
            className={`p-5 rounded-xl border cursor-pointer transition-all ${
              targetSpoke === "spoke-video-ingest"
                ? "bg-indigo-950/30 border-indigo-500 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500"
                : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  <Video className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-100">Spoke Video Ingest</h4>
                  <div className="text-[11px] font-mono text-slate-400">spoke-video-ingest</div>
                </div>
              </div>
              <Badge variant="success">Active</Badge>
            </div>
            <p className="text-xs text-slate-300 mt-2">
              Multimodal video analysis engine for YouTube and Cloud Storage. Extracts technical architectures, system diagrams, and transcribed schemas.
            </p>
          </div>
        </div>
      </div>

      {/* Step 2: Tenant Domain & Action Selector */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
          Step 2: Source App & Action Specification
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Source Domain */}
          <div>
            <label className="text-xs text-slate-300 mb-1.5 block font-medium">
              Source Application (Principal Access Boundary):
            </label>
            <select
              value={sourceApp}
              onChange={(e) => setSourceApp(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
            >
              <option value="core-hub">core-hub (Global Platform Orchestrator)</option>
              <option value="academy-apps">academy-apps (Educational Domain)</option>
              <option value="avventiq">avventiq (Enterprise Portal)</option>
            </select>
          </div>

          {/* Action */}
          <div>
            <label className="text-xs text-slate-300 mb-1.5 block font-medium">
              Action Intent:
            </label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
            >
              {targetSpoke === "spoke-housekeeper" ? (
                <>
                  <option value="clean_repo_noise">clean_repo_noise (Scrub temporary cache files)</option>
                  <option value="audit_markdown_and_schemas">audit_markdown_and_schemas (Broken links & schema audit)</option>
                  <option value="validate_firestore_rules_and_indexes">validate_firestore_rules_and_indexes (Firestore check)</option>
                </>
              ) : (
                <option value="parse_video_research">parse_video_research (Multimodal YouTube extraction)</option>
              )}
            </select>
          </div>
        </div>

        {/* Dynamic Context Form */}
        <div className="pt-2 border-t border-slate-800/80">
          {targetSpoke === "spoke-housekeeper" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-300 mb-1.5 block font-medium">
                    Target Repository Path:
                  </label>
                  <input
                    type="text"
                    value={repository}
                    onChange={(e) => setRepository(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 mb-1.5 block font-medium">
                    Target Files (Comma-separated):
                  </label>
                  <input
                    type="text"
                    value={targetFiles.join(", ")}
                    onChange={(e) =>
                      setTargetFiles(
                        e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                      )
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Checkboxes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                <label className="flex items-center gap-2 p-2.5 bg-slate-950 rounded-lg border border-slate-800/80 cursor-pointer text-xs hover:border-slate-700">
                  <input
                    type="checkbox"
                    checked={dryRun}
                    onChange={(e) => setDryRun(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Dry Run Mode</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 bg-slate-950 rounded-lg border border-slate-800/80 cursor-pointer text-xs hover:border-slate-700">
                  <input
                    type="checkbox"
                    checked={cleanTempFiles}
                    onChange={(e) => setCleanTempFiles(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Clean .DS_Store / Cache</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 bg-slate-950 rounded-lg border border-slate-800/80 cursor-pointer text-xs hover:border-slate-700">
                  <input
                    type="checkbox"
                    checked={auditMarkdown}
                    onChange={(e) => setAuditMarkdown(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Audit Markdown Links</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 bg-slate-950 rounded-lg border border-slate-800/80 cursor-pointer text-xs hover:border-slate-700">
                  <input
                    type="checkbox"
                    checked={validateFirestore}
                    onChange={(e) => setValidateFirestore(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Firestore Rules & Indexes</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 bg-slate-950 rounded-lg border border-slate-800/80 cursor-pointer text-xs hover:border-slate-700">
                  <input
                    type="checkbox"
                    checked={hitlRequired}
                    onChange={(e) => setHitlRequired(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-amber-500"
                  />
                  <span className="text-amber-400 font-semibold">Force HITL Gate Sign-off</span>
                </label>
              </div>
            </div>
          )}

          {targetSpoke === "spoke-video-ingest" && (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-300 mb-1.5 block font-medium">
                  Target YouTube or GCS Video URL:
                </label>
                <input
                  type="text"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 mb-1.5 block font-medium">
                  Architectural Research Focus:
                </label>
                <textarea
                  value={researchFocus}
                  onChange={(e) => setResearchFocus(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-300 mb-1.5 block font-medium">
                    Video Duration in Seconds (FinOps Gate &gt; 2700s trips HITL):
                  </label>
                  <input
                    type="number"
                    value={videoDurationSeconds}
                    onChange={(e) => setVideoDurationSeconds(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 p-2.5 bg-slate-950 rounded-lg border border-slate-800/80 cursor-pointer text-xs w-full hover:border-slate-700">
                    <input
                      type="checkbox"
                      checked={hitlRequired}
                      onChange={(e) => setHitlRequired(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-amber-500"
                    />
                    <span className="text-amber-400 font-semibold">Force HITL Gate Sign-off</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Step 3: Pre-Execution Cost Estimator Card */}
      <CostEstimatorCard estimate={estimate} loading={estimating} />

      {/* Action Footer */}
      <div className="flex items-center justify-between p-5 bg-slate-900/90 border border-slate-800 rounded-xl shadow-lg">
        <div>
          <div className="text-xs text-slate-400">Execution Readiness</div>
          <div className="text-sm font-semibold text-slate-200">
            {emergencyCircuitBreakerActive
              ? "Platform Halted by Operator"
              : estimate?.exceeds_threshold
              ? "Projected Cost Exceeds Monthly Ceiling"
              : "Ready to Dispatch to LangGraph Engine"}
          </div>
        </div>

        <Button
          size="lg"
          variant="primary"
          onClick={handleDispatch}
          disabled={!canExecute}
          loading={dispatching}
          icon={<Rocket className="w-5 h-5" />}
        >
          Execute Task
        </Button>
      </div>
    </div>
  );
};
