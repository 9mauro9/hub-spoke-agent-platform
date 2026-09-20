import {
  SpokeDefinition,
  CostEstimate,
  AgentTaskRequest,
  FinopsSummary,
  WorkflowEvent,
} from "./schemas.ts";

const API_BASE = "";

export interface HitlDecisionPayload {
  action: "approve" | "reject" | "feedback";
  approver_id?: string;
  comments?: string;
  feedback?: string;
}

export interface CircuitBreakerPayload {
  monthly_budget_cap_usd?: number;
  emergency_halt?: boolean;
  halt_reason?: string;
}

class HubApiClient {
  async fetchSpokes(): Promise<SpokeDefinition[]> {
    const res = await fetch(`${API_BASE}/api/v1/spokes`);
    if (!res.ok) throw new Error(`Failed to fetch spokes: ${res.statusText}`);
    const data = await res.json();
    return data.spokes || [];
  }

  async estimateTask(params: {
    target_spoke: string;
    action: string;
    target_files: string[];
    repository?: string;
    model_name?: string;
    task_prompt_length?: number;
  }): Promise<CostEstimate> {
    const res = await fetch(`${API_BASE}/api/v1/tasks/estimate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Estimation failed");
    }
    return res.json();
  }

  async dispatchTask(
    request: AgentTaskRequest,
    mode: "sync" | "async" = "async"
  ): Promise<{ session_id: string; trace_id: string; status: string; stream_url?: string }> {
    const res = await fetch(`${API_BASE}/api/v1/tasks/dispatch?mode=${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail?.error || err.detail || "Task dispatch failed");
    }
    return res.json();
  }

  async fetchTaskState(sessionId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/api/v1/tasks/${sessionId}/state`);
    if (!res.ok) throw new Error(`Failed to fetch session state: ${res.statusText}`);
    return res.json();
  }

  async fetchTaskTelemetry(sessionId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/api/v1/tasks/${sessionId}/telemetry`);
    if (!res.ok) throw new Error(`Failed to fetch telemetry: ${res.statusText}`);
    return res.json();
  }

  async submitHitlDecision(sessionId: string, payload: HitlDecisionPayload): Promise<any> {
    const res = await fetch(`${API_BASE}/api/v1/tasks/${sessionId}/hitl`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        approver_id: payload.approver_id || "operator",
        ...payload,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "HITL submission failed");
    }
    return res.json();
  }

  async fetchFinopsSummary(): Promise<FinopsSummary> {
    const res = await fetch(`${API_BASE}/api/v1/finops/summary`);
    if (!res.ok) throw new Error(`Failed to fetch FinOps summary: ${res.statusText}`);
    return res.json();
  }

  async updateCircuitBreaker(payload: CircuitBreakerPayload): Promise<any> {
    const res = await fetch(`${API_BASE}/api/v1/finops/circuit-breaker`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Failed to update circuit breaker");
    }
    return res.json();
  }

  subscribeTaskStream(
    sessionId: string,
    onEvent: (event: WorkflowEvent) => void,
    onError?: (err: any) => void
  ): () => void {
    const url = `${API_BASE}/api/v1/tasks/${sessionId}/stream`;
    const eventSource = new EventSource(url);

    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        onEvent(data);
      } catch (err) {
        console.error("Failed to parse SSE payload:", err, e.data);
      }
    };

    eventSource.onerror = (err) => {
      if (onError) onError(err);
    };

    return () => {
      eventSource.close();
    };
  }
}

export const api = new HubApiClient();
