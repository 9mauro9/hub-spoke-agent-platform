import React from "react";
import { usePlatform } from "../../contexts/PlatformContext.tsx";
import { Coins, DollarSign, Activity, ShieldCheck, AlertOctagon } from "lucide-react";

export const StatsOverview: React.FC = () => {
  const { finopsSummary, emergencyCircuitBreakerActive, sessions } = usePlatform();

  const activeSessionsCount = sessions.filter(
    (s) => s.status === "INITIALIZED" || s.status === "AWAITING_APPROVAL" || s.status === "DISPATCHED"
  ).length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Platform Status */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-md flex items-center gap-3.5">
        <div
          className={`p-3 rounded-xl ${
            emergencyCircuitBreakerActive
              ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
              : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
          }`}
        >
          {emergencyCircuitBreakerActive ? (
            <AlertOctagon className="w-6 h-6" />
          ) : (
            <ShieldCheck className="w-6 h-6" />
          )}
        </div>
        <div>
          <div className="text-xs text-slate-400 font-mono uppercase">Control Plane</div>
          <div className="text-base font-bold text-slate-100">
            {emergencyCircuitBreakerActive ? "Halted" : "Armed & Healthy"}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            {activeSessionsCount} active workflows
          </div>
        </div>
      </div>

      {/* Accumulated Tokens */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-md flex items-center gap-3.5">
        <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          <Coins className="w-6 h-6" />
        </div>
        <div>
          <div className="text-xs text-slate-400 font-mono uppercase">Total Tokens</div>
          <div className="text-base font-bold font-mono text-indigo-400">
            {(finopsSummary?.total_tokens || 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            Reconciled via Firestore
          </div>
        </div>
      </div>

      {/* Total Spend */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-md flex items-center gap-3.5">
        <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <DollarSign className="w-6 h-6" />
        </div>
        <div>
          <div className="text-xs text-slate-400 font-mono uppercase">Actual Compute Spend</div>
          <div className="text-base font-bold font-mono text-emerald-400">
            ${(finopsSummary?.total_cost_usd || 0).toFixed(4)}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            Cap: ${finopsSummary?.monthly_budget_cap_usd?.toFixed(2) || "50.00"}
          </div>
        </div>
      </div>

      {/* Budget Utilized */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-md flex items-center gap-3.5">
        <div className="p-3 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
          <Activity className="w-6 h-6" />
        </div>
        <div>
          <div className="text-xs text-slate-400 font-mono uppercase">Budget Utilization</div>
          <div className="text-base font-bold font-mono text-sky-300">
            {finopsSummary?.budget_utilized_percentage || 0}%
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            Variance: ${finopsSummary?.variance_cost_usd?.toFixed(5) || "0.00"}
          </div>
        </div>
      </div>
    </div>
  );
};
