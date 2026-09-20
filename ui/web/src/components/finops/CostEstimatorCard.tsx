import React from "react";
import { CostEstimate } from "../../api/schemas.ts";
import { Badge } from "../common/Badge.tsx";
import { Calculator, AlertTriangle, Clock, Coins, DollarSign } from "lucide-react";

interface CostEstimatorCardProps {
  estimate: CostEstimate | null;
  loading?: boolean;
}

export const CostEstimatorCard: React.FC<CostEstimatorCardProps> = ({
  estimate,
  loading = false,
}) => {
  if (loading) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 animate-pulse">
        <div className="h-4 bg-slate-800 rounded w-1/3 mb-3" />
        <div className="grid grid-cols-3 gap-3">
          <div className="h-16 bg-slate-800/60 rounded" />
          <div className="h-16 bg-slate-800/60 rounded" />
          <div className="h-16 bg-slate-800/60 rounded" />
        </div>
      </div>
    );
  }

  if (!estimate) return null;

  const isExceeded = estimate.exceeds_threshold || false;

  return (
    <div
      className={`rounded-xl border p-4 transition-all ${
        isExceeded
          ? "bg-rose-950/20 border-rose-500/50 shadow-lg shadow-rose-950/30"
          : "bg-slate-900/80 border-slate-800 shadow-md"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Pre-Execution FinOps Cost Projection
          </span>
        </div>
        <Badge variant={isExceeded ? "danger" : "info"}>
          {estimate.model_name}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {/* Total Tokens */}
        <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800/80">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
            <Coins className="w-3.5 h-3.5 text-indigo-400" />
            <span>Projected Tokens</span>
          </div>
          <div className="text-base font-bold font-mono text-slate-100">
            {estimate.estimated_total_tokens.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            in: {estimate.estimated_input_tokens} | out: {estimate.estimated_output_tokens}
          </div>
        </div>

        {/* Cost USD */}
        <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800/80">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            <span>Cost Ceiling</span>
          </div>
          <div className="text-base font-bold font-mono text-emerald-400">
            ${estimate.estimated_cost_usd.toFixed(6)}
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            Vertex AI Gemini rate
          </div>
        </div>

        {/* Runtime */}
        <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800/80">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
            <Clock className="w-3.5 h-3.5 text-sky-400" />
            <span>Est. Runtime</span>
          </div>
          <div className="text-base font-bold font-mono text-sky-300">
            ~{estimate.estimated_runtime_seconds || 2.5}s
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            Target files: {estimate.target_files_count}
          </div>
        </div>
      </div>

      {isExceeded && (
        <div className="mt-3 p-2.5 bg-rose-900/30 border border-rose-500/40 rounded-lg flex items-center gap-2 text-rose-300 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>
            Projected compute cost exceeds monthly budget cap ($
            {estimate.monthly_budget_cap_usd?.toFixed(2)}). Dispatch is locked until threshold is adjusted.
          </span>
        </div>
      )}
    </div>
  );
};
