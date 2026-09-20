import React, { useState } from "react";
import { Slider } from "../common/Slider.tsx";
import { Button } from "../common/Button.tsx";
import { Badge } from "../common/Badge.tsx";
import { ShieldAlert, AlertOctagon, CheckCircle2, Sliders } from "lucide-react";
import { api } from "../../api/client.ts";
import { usePlatform } from "../../contexts/PlatformContext.tsx";

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
  const [budgetCap, setBudgetCap] = useState<number>(currentBudgetCap || 50.0);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const handleUpdateBudget = async () => {
    setLoading(true);
    setMsg(null);
    try {
      await api.updateCircuitBreaker({ monthly_budget_cap_usd: budgetCap });
      await refreshFinops();
      setMsg("Budget ceiling updated successfully.");
      setTimeout(() => setMsg(null), 3000);
    } catch (err: any) {
      setMsg(err.message || "Failed to update budget");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEmergencyHalt = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const nextHaltState = !isActive;
      await api.updateCircuitBreaker({
        emergency_halt: nextHaltState,
        halt_reason: nextHaltState ? "Immediate emergency halt triggered from Web Management Dashboard" : undefined,
      });
      await refreshFinops();
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
