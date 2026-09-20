import { useState, useEffect, useRef } from "react";
import { api } from "../api/client.ts";
import { WorkflowEvent } from "../api/schemas.ts";
import { usePlatform } from "../contexts/PlatformContext.tsx";

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
            setActiveNode(node);
            setNodeStatuses((prev) => ({ ...prev, [node]: "executing" }));
          } else if (event.type === "node_complete") {
            setNodeStatuses((prev) => ({ ...prev, [node]: "completed" }));
          } else if (event.type === "node_retry") {
            setNodeStatuses((prev) => ({ ...prev, [node]: "retry" }));
          } else if (event.type === "node_error") {
            setNodeStatuses((prev) => ({ ...prev, [node]: "error" }));
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
