import React from "react";
import { Handle, Position } from "@xyflow/react";
import { clsx } from "clsx";
import {
  Layers,
  ShieldCheck,
  Calculator,
  Send,
  CheckCircle2,
  UserCheck,
  Database,
  AlertTriangle,
  RotateCcw,
  Loader2,
} from "lucide-react";

interface NodeData {
  label: string;
  sublabel: string;
  stepNumber: number;
  status: "idle" | "executing" | "completed" | "error" | "paused" | "retry";
  nodeKey: string;
}

export const ExecutionNode: React.FC<{ data: NodeData }> = ({ data }) => {
  const { label, sublabel, stepNumber, status, nodeKey } = data;

  const getIcon = () => {
    switch (nodeKey) {
      case "init_state":
        return <Layers className="w-4 h-4" />;
      case "analyzer_agent":
        return <ShieldCheck className="w-4 h-4" />;
      case "pre_execution_cost_estimator":
        return <Calculator className="w-4 h-4" />;
      case "dispatch_task":
        return <Send className="w-4 h-4" />;
      case "validation_node":
        return <CheckCircle2 className="w-4 h-4" />;
      case "hitl_approval_gate":
        return <UserCheck className="w-4 h-4" />;
      case "commit_telemetry":
        return <Database className="w-4 h-4" />;
      default:
        return <Layers className="w-4 h-4" />;
    }
  };

  const statusBorderColor = {
    idle: "border-slate-700 bg-slate-900/90 text-slate-400",
    executing: "border-sky-500 bg-sky-950/40 text-sky-200 shadow-lg shadow-sky-500/30 ring-2 ring-sky-500/50 animate-pulse",
    completed: "border-emerald-500 bg-emerald-950/30 text-emerald-200 shadow-md shadow-emerald-500/20",
    paused: "border-amber-500 bg-amber-950/40 text-amber-200 shadow-lg shadow-amber-500/30 ring-2 ring-amber-500/60",
    error: "border-rose-500 bg-rose-950/40 text-rose-200 shadow-lg shadow-rose-500/30",
    retry: "border-orange-500 bg-orange-950/40 text-orange-200 shadow-md shadow-orange-500/20 ring-1 ring-orange-500",
  }[status];

  const badgeColor = {
    idle: "bg-slate-800 text-slate-400",
    executing: "bg-sky-500 text-slate-950 font-bold",
    completed: "bg-emerald-500 text-slate-950 font-bold",
    paused: "bg-amber-500 text-slate-950 font-bold animate-bounce",
    error: "bg-rose-500 text-white font-bold",
    retry: "bg-orange-500 text-slate-950 font-bold",
  }[status];

  return (
    <div
      className={clsx(
        "px-4 py-3 rounded-xl border min-w-[200px] transition-all backdrop-blur-md relative",
        statusBorderColor
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-slate-600 !border-2 !border-slate-900"
      />

      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2">
          <span className="p-1 rounded-md bg-slate-800/80 text-slate-300">
            {getIcon()}
          </span>
          <span className="text-xs font-mono font-semibold tracking-wider opacity-70">
            STEP {stepNumber}
          </span>
        </div>
        <span
          className={clsx(
            "text-[10px] uppercase px-1.5 py-0.5 rounded tracking-wider",
            badgeColor
          )}
        >
          {status === "executing" ? (
            <span className="flex items-center gap-1">
              <Loader2 className="w-2.5 h-2.5 animate-spin" /> RUNNING
            </span>
          ) : status === "paused" ? (
            <span className="flex items-center gap-1">
              <AlertTriangle className="w-2.5 h-2.5" /> HITL
            </span>
          ) : status === "retry" ? (
            <span className="flex items-center gap-1">
              <RotateCcw className="w-2.5 h-2.5" /> RETRY
            </span>
          ) : (
            status
          )}
        </span>
      </div>

      <div className="text-sm font-semibold tracking-tight leading-snug">
        {label}
      </div>
      <div className="text-[11px] text-slate-400 mt-0.5 truncate font-mono">
        {sublabel}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-slate-600 !border-2 !border-slate-900"
      />
    </div>
  );
};
