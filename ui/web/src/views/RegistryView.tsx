import React, { useState } from "react";
import { usePlatform } from "../contexts/PlatformContext.tsx";
import { SpokeCard } from "../components/registry/SpokeCard.tsx";
import { Badge } from "../components/common/Badge.tsx";
import { Button } from "../components/common/Button.tsx";
import { Server, RefreshCw, CheckCircle2, ShieldCheck } from "lucide-react";

interface RegistryViewProps {
  onSelectAction: (spokeId: string, actionId: string) => void;
}

export const RegistryView: React.FC<RegistryViewProps> = ({ onSelectAction }) => {
  const { spokes, refreshSpokes } = usePlatform();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshSpokes();
    setRefreshing(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
            <Server className="w-6 h-6 text-indigo-400" />
            Spoke Worker Registry & Health Probes
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Registered microservices, Model Context Protocol (MCP) endpoints, and dynamic parameter contracts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="success" icon={<CheckCircle2 className="w-3.5 h-3.5" />}>
            All Probes Passing
          </Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            loading={refreshing}
            icon={<RefreshCw className="w-4 h-4 text-indigo-400" />}
          >
            Poll Probes
          </Button>
        </div>
      </div>

      {/* Spoke Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {spokes.map((spoke) => (
          <SpokeCard
            key={spoke.id}
            spoke={spoke}
            onSelectAction={onSelectAction}
          />
        ))}
      </div>

      {/* Protocol Architecture Reference */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <h4 className="text-sm font-bold text-slate-200 uppercase tracking-wider font-mono">
            Contract & Security Specification
          </h4>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          Every Spoke communicates with the Master Orchestrator (Hub) exclusively via validated JSON schemas:{" "}
          <code className="text-indigo-300">config/schemas/task_request.json</code> and{" "}
          <code className="text-indigo-300">config/schemas/task_response.json</code>.
          Any message failing edge sanitization or schema compliance is immediately quarantined into{" "}
          <code className="text-rose-400">agent-dlq</code> to eliminate poison-pill vulnerabilities.
        </p>
      </div>
    </div>
  );
};
