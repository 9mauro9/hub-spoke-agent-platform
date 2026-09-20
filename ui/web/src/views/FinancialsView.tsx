import React from "react";
import { usePlatform } from "../contexts/PlatformContext.tsx";
import { VarianceChart } from "../components/finops/VarianceChart.tsx";
import { ProjectCostBreakdown } from "../components/finops/ProjectCostBreakdown.tsx";
import { EmergencyCircuitBreaker } from "../components/finops/EmergencyCircuitBreaker.tsx";
import { Badge } from "../components/common/Badge.tsx";
import { DollarSign, RefreshCw } from "lucide-react";
import { Button } from "../components/common/Button.tsx";

export const FinancialsView: React.FC = () => {
  const { finopsSummary, emergencyCircuitBreakerActive, refreshFinops } = usePlatform();

  const totalCost = finopsSummary?.total_cost_usd || 0.0;
  const budgetCap = finopsSummary?.monthly_budget_cap_usd || 50.0;
  const recentTelemetry = finopsSummary?.recent_telemetry || [];
  const domains = finopsSummary?.domains || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
            <DollarSign className="w-6 h-6 text-emerald-400" />
            FinOps & Governance Control Center
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time token expenditures, budget thresholds, cross-tenant project allocations, and circuit breaker governance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant={emergencyCircuitBreakerActive ? "danger" : "success"}>
            {emergencyCircuitBreakerActive ? "Circuit Breaker Tripped" : "FinOps Guardrails Armed"}
          </Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={refreshFinops}
            icon={<RefreshCw className="w-4 h-4 text-indigo-400" />}
          >
            Reconcile
          </Button>
        </div>
      </div>

      {/* Emergency Circuit Breaker & Spend Limits */}
      <EmergencyCircuitBreaker
        currentBudgetCap={budgetCap}
        isActive={emergencyCircuitBreakerActive}
        haltReason={finopsSummary?.halt_reason}
      />

      {/* Project Allocation Breakdown */}
      <ProjectCostBreakdown
        domains={domains}
        totalCost={totalCost}
      />

      {/* Estimate vs Actual Variance Table */}
      <VarianceChart records={recentTelemetry} />
    </div>
  );
};
