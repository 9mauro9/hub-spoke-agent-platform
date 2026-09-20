import React, { createContext, useContext, useState, useEffect } from "react";
import { api } from "../api/client.ts";
import { FinopsSummary, SpokeDefinition } from "../api/schemas.ts";

interface SessionMeta {
  sessionId: string;
  traceId: string;
  targetSpoke: string;
  action: string;
  status: string;
  startTime: number;
}

interface PlatformContextType {
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;
  sessions: SessionMeta[];
  addSession: (meta: SessionMeta) => void;
  updateSessionStatus: (sessionId: string, status: string) => void;
  spokes: SpokeDefinition[];
  finopsSummary: FinopsSummary | null;
  refreshFinops: () => Promise<void>;
  refreshSpokes: () => Promise<void>;
  emergencyCircuitBreakerActive: boolean;
  setEmergencyCircuitBreakerActive: (active: boolean) => void;
}

const PlatformContext = createContext<PlatformContextType | undefined>(undefined);

export const PlatformProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionMeta[]>(() => {
    try {
      const saved = localStorage.getItem("hub_sessions");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [spokes, setSpokes] = useState<SpokeDefinition[]>([]);
  const [finopsSummary, setFinopsSummary] = useState<FinopsSummary | null>(null);
  const [emergencyCircuitBreakerActive, setEmergencyCircuitBreakerActive] = useState<boolean>(false);

  useEffect(() => {
    localStorage.setItem("hub_sessions", JSON.stringify(sessions.slice(0, 50)));
  }, [sessions]);

  const refreshSpokes = async () => {
    try {
      const data = await api.fetchSpokes();
      setSpokes(data);
    } catch (err) {
      console.error("Failed to load spokes:", err);
    }
  };

  const refreshFinops = async () => {
    try {
      const summary = await api.fetchFinopsSummary();
      setFinopsSummary(summary);
      setEmergencyCircuitBreakerActive(summary.emergency_circuit_breaker_active);
    } catch (err) {
      console.error("Failed to load FinOps summary:", err);
    }
  };

  useEffect(() => {
    refreshSpokes();
    refreshFinops();
    const timer = setInterval(() => {
      refreshFinops();
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const addSession = (meta: SessionMeta) => {
    setSessions((prev) => [meta, ...prev.filter((s) => s.sessionId !== meta.sessionId)]);
    setActiveSessionId(meta.sessionId);
  };

  const updateSessionStatus = (sessionId: string, status: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.sessionId === sessionId ? { ...s, status } : s))
    );
  };

  return (
    <PlatformContext.Provider
      value={{
        activeSessionId,
        setActiveSessionId,
        sessions,
        addSession,
        updateSessionStatus,
        spokes,
        finopsSummary,
        refreshFinops,
        refreshSpokes,
        emergencyCircuitBreakerActive,
        setEmergencyCircuitBreakerActive,
      }}
    >
      {children}
    </PlatformContext.Provider>
  );
};

export const usePlatform = (): PlatformContextType => {
  const ctx = useContext(PlatformContext);
  if (!ctx) throw new Error("usePlatform must be used within PlatformProvider");
  return ctx;
};
