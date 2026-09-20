import React from "react";
import { usePlatform } from "../contexts/PlatformContext.tsx";
import { useAuth, ControlPlaneRole } from "../context/AuthContext.tsx";
import { Badge } from "../components/common/Badge.tsx";
import {
  Rocket,
  Activity,
  Server,
  DollarSign,
  ShieldCheck,
  AlertOctagon,
  Cpu,
  UserCheck,
  Radio,
} from "lucide-react";

export type ViewTab = "launcher" | "monitor" | "registry" | "financials";

interface AppLayoutProps {
  currentTab: ViewTab;
  onTabChange: (tab: ViewTab) => void;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  currentTab,
  onTabChange,
  children,
}) => {
  const {
    activeSessionId,
    emergencyCircuitBreakerActive,
    finopsSummary,
  } = usePlatform();
  const { activeRole, setActiveRole } = useAuth();

  const navItems: { id: ViewTab; label: string; icon: React.ReactNode }[] = [
    { id: "launcher", label: "Task Launcher", icon: <Rocket className="w-4 h-4" /> },
    { id: "monitor", label: "Live Execution", icon: <Activity className="w-4 h-4" /> },
    { id: "registry", label: "Spoke Registry", icon: <Server className="w-4 h-4" /> },
    { id: "financials", label: "FinOps & Governance", icon: <DollarSign className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Platform Emergency Warning Banner */}
      {emergencyCircuitBreakerActive && (
        <div className="bg-rose-600 text-white px-4 py-2 text-xs font-semibold flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2 max-w-5xl mx-auto w-full">
            <AlertOctagon className="w-4 h-4 shrink-0 animate-bounce" />
            <span>
              EMERGENCY CIRCUIT BREAKER ENGAGED — Platform execution is paused. All Spoke dispatches are blocked.
            </span>
          </div>
        </div>
      )}

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo & Platform Name */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-lg shadow-indigo-600/30 border border-indigo-400/30">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-white">
                  Hub & Spoke Control Center
                </span>
                <Badge variant="purple" className="font-mono text-[10px]">
                  AES v3
                </Badge>
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                Google Antigravity Autonomous Platform
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            {navItems.map((item) => {
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                  }`}
                >
                  {item.icon}
                  {item.label}
                  {item.id === "monitor" && activeSessionId && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Active Session & System Health */}
          <div className="flex items-center gap-3">
            {activeSessionId && (
              <div
                onClick={() => onTabChange("monitor")}
                className="hidden md:flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono cursor-pointer hover:border-slate-700 transition-colors"
                title="Active Execution Session"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-slate-400">Session:</span>
                <span className="text-indigo-300 font-semibold truncate max-w-[100px]">
                  {activeSessionId}
                </span>
              </div>
            )}

            {/* Operator Persona & RBAC Role Selector */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs">
              <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
              <select
                value={activeRole}
                onChange={(e) => setActiveRole(e.target.value as ControlPlaneRole)}
                className="bg-transparent text-slate-300 font-mono text-[11px] focus:outline-none cursor-pointer"
                title="Active Operator RBAC Persona"
              >
                <option value="platform_operator" className="bg-slate-900 text-slate-200">
                  Role: Operator
                </option>
                <option value="admin" className="bg-slate-900 text-slate-200">
                  Role: Admin
                </option>
                <option value="viewer" className="bg-slate-900 text-slate-200">
                  Role: Viewer
                </option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-300">Hub Online</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-6">{children}</main>

      {/* Persistent System Health & Telemetry Footer */}
      <footer className="bg-slate-950 border-t border-slate-800/80 px-6 py-2.5 text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Master Orchestrator Cloud Run (AES v3 Standard)
            </span>
            <span className="text-slate-700">|</span>
            <span className="flex items-center gap-1.5 text-indigo-400">
              <Radio className="w-3 h-3 text-indigo-400 animate-pulse" />
              SpokeOps Telemetry Active
            </span>
            <span className="text-slate-700">|</span>
            <span>Firestore In-Memory / ADC Stream Active</span>
          </div>

          <div className="flex items-center gap-4">
            <span>
              Total Tokens:{" "}
              <strong className="text-slate-300">
                {(finopsSummary?.total_tokens || 0).toLocaleString()}
              </strong>
            </span>
            <span className="text-slate-700">|</span>
            <span>
              Budget:{" "}
              <strong className="text-emerald-400">
                ${(finopsSummary?.total_cost_usd || 0).toFixed(4)} / $
                {finopsSummary?.monthly_budget_cap_usd?.toFixed(2) || "50.00"}
              </strong>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};
