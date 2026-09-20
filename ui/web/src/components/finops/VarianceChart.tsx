import React from "react";
import { FinopsTelemetryRecord } from "../../api/schemas.ts";
import { Badge } from "../common/Badge.tsx";
import { BarChart3 } from "lucide-react";

interface VarianceChartProps {
  records: FinopsTelemetryRecord[];
}

export const VarianceChart: React.FC<VarianceChartProps> = ({ records }) => {
  if (!records || records.length === 0) {
    return (
      <div className="text-center py-10 bg-slate-900/60 rounded-xl border border-slate-800 text-slate-500 text-xs">
        No completed session telemetry recorded yet.
      </div>
    );
  }

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
            Estimate vs. Actual Variance Reconciliation
          </h3>
        </div>
        <Badge variant="info">
          Latest {records.length} Executions
        </Badge>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
            <tr>
              <th className="p-2.5">Session ID</th>
              <th className="p-2.5">Spoke / Action</th>
              <th className="p-2.5">Actual Tokens</th>
              <th className="p-2.5">Est. Cost</th>
              <th className="p-2.5">Actual Cost</th>
              <th className="p-2.5">Variance</th>
              <th className="p-2.5">Accuracy</th>
              <th className="p-2.5">Duration</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {records.map((rec) => {
              const varianceCost = rec.cost_variance_usd;
              const isFavorable = varianceCost <= 0;

              return (
                <tr key={rec.session_id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-2.5 font-semibold text-slate-200 truncate max-w-[120px]">
                    {rec.session_id.slice(0, 10)}...
                  </td>
                  <td className="p-2.5">
                    <span className="text-indigo-300 font-sans font-semibold">{rec.spoke_id}</span>
                    <div className="text-[10px] text-slate-500 font-mono">{rec.action}</div>
                  </td>
                  <td className="p-2.5 text-slate-300 font-bold">
                    {rec.actual_tokens.toLocaleString()}
                  </td>
                  <td className="p-2.5 text-slate-400">
                    ${rec.estimated_cost_usd.toFixed(5)}
                  </td>
                  <td className="p-2.5 text-emerald-400 font-bold">
                    ${rec.actual_cost_usd.toFixed(5)}
                  </td>
                  <td className={`p-2.5 font-bold ${isFavorable ? "text-emerald-400" : "text-amber-400"}`}>
                    {isFavorable ? "-" : "+"}${Math.abs(varianceCost).toFixed(5)}
                  </td>
                  <td className="p-2.5">
                    <span className="px-2 py-0.5 rounded text-[11px] bg-slate-950 border border-slate-800 text-indigo-300">
                      {rec.accuracy_percentage}%
                    </span>
                  </td>
                  <td className="p-2.5 text-slate-400">
                    {rec.duration_ms}ms
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
