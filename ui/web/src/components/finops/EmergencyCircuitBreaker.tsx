import React, { useState } from "react";
import { Slider } from "../common/Slider.tsx";
import { Button } from "../common/Button.tsx";
import { Badge } from "../common/Badge.tsx";
import { ShieldAlert, AlertOctagon, CheckCircle2, Sliders } from "lucide-react";
import { api } from "../../api/client.ts";
import { usePlatform } from "../../contexts/PlatformContext.tsx";
import { useAuth } from "../../context/AuthContext.tsx";
import { spokeOps } from "@/telemetry/spokeOpsClient.ts";

interface EmergencyCircuitBreakerProps {
  currentBudgetCap: number;
  isActive: boolean;
  haltReason?: string | null;
}

export const EmergencyCircuitBreaker: React.FC<EmergencyCircuitBreakerProps> = ({
  currentBudgetCap,
  isActive,
  haltReason,
}) => {
  const { refreshFinops } = usePlatform();
  const { user, checkPermission } = useAuth();
  const [budgetCap, setBudgetCap] = useState<number>(currentBudgetCap || 50.0);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const handleUpdateBudget = async () => {
    // Step 2.3 of directive: Check RBAC permission for policy updates
    if (!checkPermission("admin", "/governance/circuit-breaker/budget")) {
      setMsg("Permission Denied: Only Admin role can adjust monthly budget ceilings.");
      return;
    }

    setLoading(true);
    setMsg(null);
    try {
      await api.updateCircuitBreaker({ monthly_budget_cap_usd: budgetCap });
      await refreshFinops();

      // Emit policy_update audit event
      spokeOps.logAudit({
        action: "policy_update",
        resourceType: "tenant_policy",
        resourceId: "monthly_budget_cap_usd",
        status: "success",
        metadata: {
          newBudgetCapUsd: budgetCap,
          updatedBy: user.email,
          role: user.roles[0],
        },
      });

      setMsg("Budget ceiling updated successfully.");
      setTimeout(() => setMsg(null), 3000);
    } catch (err: any) {
      setMsg(err.message || "Failed to update budget");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEmergencyHalt = async () => {
    // Step 2.3 of directive: Check RBAC permission for emergency kill switch
    if (!checkPermission("admin", "/governance/circuit-breaker/halt")) {
      setMsg("Permission Denied: Only Admin role can toggle master emergency kill switch.");
      return;
    }

    setLoading(true);
    setMsg(null);
    try {
      const nextHaltState = !isActive;
      await api.updateCircuitBreaker({
        emergency_halt: nextHaltState,
        halt_reason: nextHaltState ? `Immediate emergency halt triggered by ${user.displayName}` : undefined,
      });
      await refreshFinops();

      // Emit policy_update audit event
      spokeOps.logAudit({
        action: "policy_update",
        resourceType: "tenant_policy",
        resourceId: "emergency_circuit_breaker",
        status: nextHaltState ? "warning" : "success",
        metadata: {
          emergencyHaltActive: nextHaltState,
          operator: user.email,
          role: user.roles[0],
        },
      });
    } catch (err: any) {
      setMsg(err.message || "Failed to toggle emergency circuit breaker");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-indigo-400" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
            Platform Governance & Emergency Circuit Breaker
          </h3>
        </div>
        <Badge variant={isActive ? "danger" : "success"} pulse={isActive}>
          {isActive ? "EXECUTION HALTED" : "SYSTEM ARMED & ACTIVE"}
        </Badge>
      </div>

      {msg && (
        <div className="p-2.5 bg-indigo-950/40 border border-indigo-500/40 text-indigo-300 text-xs rounded-lg">
          {msg}
        </div>
      )}

      {isActive && (
        <div className="p-3.5 bg-rose-950/40 border border-rose-500/50 rounded-xl flex items-start gap-3">
          <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="text-xs text-rose-200 leading-relaxed">
            <span className="font-bold">CRITICAL: Emergency Circuit Breaker is ACTIVE! </span>
            All incoming task dispatches across spokes are blocked. Reason:{" "}
            <em>{haltReason || "Manual kill switch engaged by operator."}</em>
          </div>
        </div>
      )}

      {/* Monthly Budget Slider */}
      <div className="space-y-3 pt-2">
        <Slider
          label="Monthly Spend Cap Ceiling"
          value={budgetCap}
          min={5}
          max={500}
          step={5}
          unit="$"
          onChange={setBudgetCap}
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={handleUpdateBudget}
            loading={loading}
            icon={<Sliders className="w-3.5 h-3.5" />}
          >
            Apply Spend Limit
          </Button>
        </div>
      </div>

      {/* Emergency Kill Switch */}
      <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-200">
            Master Emergency Kill Switch
          </div>
          <div className="text-xs text-slate-400">
            Instantly trips the circuit breaker to freeze all multi-agent pipelines.
          </div>
        </div>
        <Button
          variant={isActive ? "success" : "danger"}
          onClick={handleToggleEmergencyHalt}
          loading={loading}
          icon={isActive ? <CheckCircle2 className="w-4 h-4" /> : <AlertOctagon className="w-4 h-4" />}
        >
          {isActive ? "Reset & Resume Platform" : "HALT ALL AGENTS"}
        </Button>
      </div>
    </div>
  );
};
