import React from "react";
import { SpokeDefinition } from "../../api/schemas.ts";
import { Badge } from "../common/Badge.tsx";
import { Button } from "../common/Button.tsx";
import { Cpu, Server, Play, Shield } from "lucide-react";

interface SpokeCardProps {
  spoke: SpokeDefinition;
  onSelectAction?: (spokeId: string, actionId: string) => void;
}

export const SpokeCard: React.FC<SpokeCardProps> = ({
  spoke,
  onSelectAction,
}) => {
  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4 hover:border-slate-700 transition-all flex flex-col justify-between">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-100">{spoke.name}</h4>
              <div className="text-xs font-mono text-slate-400">{spoke.id}</div>
            </div>
          </div>
          <Badge variant={spoke.status === "Active" ? "success" : "neutral"} pulse={spoke.status === "Active"}>
            {spoke.status}
          </Badge>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          {spoke.description}
        </p>

        {/* MCP Endpoint */}
        <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800/80 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2 text-slate-400">
            <Server className="w-3.5 h-3.5 text-indigo-400" />
            <span>MCP Endpoint:</span>
          </div>
          <span className="text-slate-200 select-all">{spoke.mcp_endpoint}</span>
        </div>

        {/* Allowed Domain Boundaries */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          <span className="text-[10px] uppercase font-mono text-slate-500 flex items-center gap-1">
            <Shield className="w-3 h-3 text-emerald-400" /> PAB:
          </span>
          {spoke.allowed_sources.map((src) => (
            <span
              key={src}
              className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700"
            >
              {src}
            </span>
          ))}
        </div>

        {/* Supported Actions */}
        <div className="space-y-1.5 pt-2">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
            Supported Actions ({spoke.actions.length})
          </div>
          <div className="space-y-1.5">
            {spoke.actions.map((act) => (
              <div
                key={act.id}
                className="p-2 bg-slate-950/60 rounded-lg border border-slate-800/80 flex items-center justify-between hover:border-slate-700 transition-colors"
              >
                <div>
                  <div className="text-xs font-semibold text-slate-200">{act.name}</div>
                  <div className="text-[11px] text-slate-400 truncate max-w-[260px]">
                    {act.description}
                  </div>
                </div>
                {onSelectAction && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onSelectAction(spoke.id, act.id)}
                    icon={<Play className="w-3 h-3 text-indigo-400" />}
                  >
                    Launch
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500 font-mono">
        <span>AES v3 Standard</span>
        <span>v{spoke.version}</span>
      </div>
    </div>
  );
};
