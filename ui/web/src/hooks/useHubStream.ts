import { useState, useEffect, useRef } from "react";
import { api } from "../api/client.ts";
import { WorkflowEvent } from "../api/schemas.ts";
import { usePlatform } from "../contexts/PlatformContext.tsx";
import { spokeOps } from "@/telemetry/spokeOpsClient.ts";

export interface NodeStatusMap {
  [nodeId: string]: "idle" | "executing" | "completed" | "error" | "paused" | "retry";
}

export function useHubStream(sessionId: string | null) {
  const { updateSessionStatus, refreshFinops } = usePlatform();
  const [events, setEvents] = useState<WorkflowEvent[]>([]);
  const [activeNode, setActiveNode] = useState<string | null>(null);
  const [nodeStatuses, setNodeStatuses] = useState<NodeStatusMap>({});
  const [isHitlWaiting, setIsHitlWaiting] = useState<boolean>(false);
  const [hitlPayload, setHitlPayload] = useState<any | null>(null);
  const [latestState, setLatestState] = useState<any | null>(null);
  const [streamConnected, setStreamConnected] = useState<boolean>(false);
  const [accumulatedTokens, setAccumulatedTokens] = useState<number>(0);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const nodeStartTimesRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!sessionId) {
      setEvents([]);
      setActiveNode(null);
      setNodeStatuses({});
      setIsHitlWaiting(false);
      setHitlPayload(null);
      setLatestState(null);
      setStreamConnected(false);
      setAccumulatedTokens(0);
      return;
    }

    setEvents([]);
    setIsHitlWaiting(false);
    setHitlPayload(null);

    // Initial state check
    api.fetchTaskState(sessionId).then((st) => {
      if (st) {
        setLatestState(st);
        if (st.status === "AWAITING_APPROVAL") {
          setIsHitlWaiting(true);
          setHitlPayload({
            state: st,
            validation_result: st.validation_result,
            spoke_response: st.spoke_response,
          });
        }
        if (st.reconciled_usage?.actual_tokens) {
          setAccumulatedTokens(st.reconciled_usage.actual_tokens);
        }
      }
    }).catch(() => {});

    const unsubscribe = api.subscribeTaskStream(
      sessionId,
      (event: WorkflowEvent) => {
        setStreamConnected(true);
        setEvents((prev) => [...prev, event]);

        if (event.state) {
          setLatestState(event.state);
        }

        const node = event.node;
        if (node) {
          if (event.type === "node_start") {
            nodeStartTimesRef.current[node] = Date.now();
            setActiveNode(node);
            setNodeStatuses((prev) => ({ ...prev, [node]: "executing" }));
          } else if (event.type === "node_complete") {
            const start = nodeStartTimesRef.current[node] || Date.now();
            const duration = Date.now() - start;
            setNodeStatuses((prev) => ({ ...prev, [node]: "completed" }));

            // Step 2.2 of directive: Emit agent_task_executed audit event
            spokeOps.logAudit({
              action: "agent_task_executed",
              resourceType: "tool_dispatch",
              resourceId: node,
              status: "success",
              metadata: {
                executionDurationMs: duration,
                tool: node,
                sessionId: sessionId,
              },
            });
          } else if (event.type === "node_retry") {
            setNodeStatuses((prev) => ({ ...prev, [node]: "retry" }));
          } else if (event.type === "node_error") {
            const start = nodeStartTimesRef.current[node] || Date.now();
            const duration = Date.now() - start;
            setNodeStatuses((prev) => ({ ...prev, [node]: "error" }));

            // Step 2.2 of directive: Emit agent_task_executed with warning/failure status
            spokeOps.logAudit({
              action: "agent_task_executed",
              resourceType: "tool_dispatch",
              resourceId: node,
              status: "warning",
              metadata: {
                executionDurationMs: duration,
                tool: node,
                sessionId: sessionId,
                error: (event as any).error || "Node execution failure",
              },
            });
          }
        }

        if (event.type === "hitl_required") {
          setIsHitlWaiting(true);
          setActiveNode("hitl_approval_gate");
          setNodeStatuses((prev) => ({ ...prev, hitl_approval_gate: "paused" }));
          setHitlPayload(event);
          updateSessionStatus(sessionId, "AWAITING_APPROVAL");
        }

        if (event.type === "hitl_approved") {
          setIsHitlWaiting(false);
          setNodeStatuses((prev) => ({ ...prev, hitl_approval_gate: "completed" }));
        }

        if (event.type === "workflow_complete") {
          setIsHitlWaiting(false);
          setActiveNode(null);
          setNodeStatuses((prev) => ({
            ...prev,
            commit_telemetry: "completed",
          }));
          updateSessionStatus(sessionId, "COMPLETED");
          refreshFinops();
          if (event.reconciled_usage?.actual_tokens) {
            setAccumulatedTokens(event.reconciled_usage.actual_tokens);
          }

          // Step 2 of directive: Emit workflow-level execution audit event
          spokeOps.logAudit({
            action: "agent_task_executed",
            resourceType: "agent_workflow",
            resourceId: sessionId,
            status: "success",
            metadata: {
              reconciledTokens: event.reconciled_usage?.actual_tokens || 0,
              costUsd: event.reconciled_usage?.actual_cost_usd || 0,
            },
          });
        }

        if (event.type === "task_rejected") {
          setIsHitlWaiting(false);
          setActiveNode(null);
          setNodeStatuses((prev) => ({
            ...prev,
            hitl_approval_gate: "error",
          }));
          updateSessionStatus(sessionId, "REJECTED");
          refreshFinops();

          // Step 2 of directive: Emit agent_task_failed audit event
          spokeOps.logAudit({
            action: "agent_task_failed",
            resourceType: "agent_workflow",
            resourceId: sessionId,
            status: "warning",
            metadata: {
              reason: "Task rejected by operator at Human-in-the-Loop gate",
            },
          });
        }
      },
      (err) => {
        console.warn("SSE stream notice for session", sessionId, err);
        setStreamConnected(false);
      }
    );

    unsubscribeRef.current = unsubscribe;

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [sessionId]);

  return {
    events,
    activeNode,
    nodeStatuses,
    isHitlWaiting,
    hitlPayload,
    latestState,
    streamConnected,
    accumulatedTokens,
  };
}
