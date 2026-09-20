import React from "react";
import { PieChart } from "lucide-react";

interface DomainMetrics {
  tokens: number;
  cost_usd: number;
  tasks: number;
}

interface ProjectCostBreakdownProps {
  domains: Record<string, DomainMetrics>;
  totalCost: number;
}

export const ProjectCostBreakdown: React.FC<ProjectCostBreakdownProps> = ({
  domains,
  totalCost,
}) => {
  const domainColors: Record<string, { bar: string; text: string; bg: string }> = {
    "academy-apps": { bar: "bg-indigo-500", text: "text-indigo-400", bg: "bg-indigo-950/30 border-indigo-500/20" },
    "avventiq": { bar: "bg-emerald-500", text: "text-emerald-400", bg: "bg-emerald-950/30 border-emerald-500/20" },
    "core-hub": { bar: "bg-sky-500", text: "text-sky-400", bg: "bg-sky-950/30 border-sky-500/20" },
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PieChart className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
            Cost Allocation by Downstream Tenant Domain
          </h3>
        </div>
        <span className="text-xs font-mono text-slate-400">
          Total Incurred: <strong className="text-emerald-400">${totalCost.toFixed(6)}</strong>
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {Object.entries(domains).map(([domainName, metrics]) => {
          const colors = domainColors[domainName] || {
            bar: "bg-slate-500",
            text: "text-slate-400",
            bg: "bg-slate-950 border-slate-800",
          };
          const pct = totalCost > 0 ? (metrics.cost_usd / totalCost) * 100 : 0;

          return (
            <div
              key={domainName}
              className={`p-4 rounded-xl border ${colors.bg} space-y-2`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  {domainName}
                </span>
                <span className={`text-xs font-mono font-bold ${colors.text}`}>
                  {pct.toFixed(1)}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full ${colors.bar} rounded-full transition-all duration-500`}
                  style={{ width: `${Math.max(4, pct)}%` }}
                />
              </div>

              <div className="pt-2 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">Tasks: {metrics.tasks}</span>
                <span className="text-slate-200 font-bold">${metrics.cost_usd.toFixed(5)}</span>
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                Tokens: {metrics.tokens.toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
