import React, { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  Node,
  Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ExecutionNode } from "./ExecutionNode.tsx";
import { NodeStatusMap } from "../../hooks/useHubStream.ts";

interface LangGraphVisualizerProps {
  nodeStatuses: NodeStatusMap;
  activeNode: string | null;
  onNodeClick?: (nodeId: string) => void;
}

const nodeTypes = {
  executionNode: ExecutionNode,
};

export const LangGraphVisualizer: React.FC<LangGraphVisualizerProps> = ({
  nodeStatuses,
  activeNode,
  onNodeClick,
}) => {
  const nodesConfig = [
    {
      id: "init_state",
      label: "Init State",
      sublabel: "Firestore session & trace init",
      stepNumber: 1,
      x: 30,
      y: 120,
    },
    {
      id: "analyzer_agent",
      label: "Analyzer & PAB",
      sublabel: "Tenant perimeter policy check",
      stepNumber: 2,
      x: 280,
      y: 120,
    },
    {
      id: "pre_execution_cost_estimator",
      label: "Cost Estimator",
      sublabel: "FinOps pre-run token ceiling",
      stepNumber: 3,
      x: 530,
      y: 120,
    },
    {
      id: "dispatch_task",
      label: "Dispatch Task",
      sublabel: "Pub/Sub target spoke invocation",
      stepNumber: 4,
      x: 780,
      y: 120,
    },
    {
      id: "validation_node",
      label: "Validation Gate",
      sublabel: "Contract & retry diff check",
      stepNumber: 5,
      x: 1030,
      y: 120,
    },
    {
      id: "hitl_approval_gate",
      label: "HITL Gate",
      sublabel: "Human approval & diff sign-off",
      stepNumber: 6,
      x: 1280,
      y: 120,
    },
    {
      id: "commit_telemetry",
      label: "Commit Telemetry",
      sublabel: "Token reconciliation & commit",
      stepNumber: 7,
      x: 1530,
      y: 120,
    },
  ];

  const nodes: Node[] = useMemo(() => {
    return nodesConfig.map((n) => {
      const status = nodeStatuses[n.id] || "idle";
      return {
        id: n.id,
        type: "executionNode",
        position: { x: n.x, y: n.y },
        data: {
          label: n.label,
          sublabel: n.sublabel,
          stepNumber: n.stepNumber,
          status,
          nodeKey: n.id,
        },
      };
    });
  }, [nodeStatuses, activeNode]);

  const edges: Edge[] = useMemo(() => {
    const defaultEdges: Edge[] = [
      {
        id: "e1-2",
        source: "init_state",
        target: "analyzer_agent",
        animated: activeNode === "analyzer_agent",
        style: { stroke: nodeStatuses["init_state"] === "completed" ? "#10b981" : "#475569", strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: nodeStatuses["init_state"] === "completed" ? "#10b981" : "#475569" },
      },
      {
        id: "e2-3",
        source: "analyzer_agent",
        target: "pre_execution_cost_estimator",
        animated: activeNode === "pre_execution_cost_estimator",
        style: { stroke: nodeStatuses["analyzer_agent"] === "completed" ? "#10b981" : "#475569", strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: nodeStatuses["analyzer_agent"] === "completed" ? "#10b981" : "#475569" },
      },
      {
        id: "e3-4",
        source: "pre_execution_cost_estimator",
        target: "dispatch_task",
        animated: activeNode === "dispatch_task",
        style: { stroke: nodeStatuses["pre_execution_cost_estimator"] === "completed" ? "#10b981" : "#475569", strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: nodeStatuses["pre_execution_cost_estimator"] === "completed" ? "#10b981" : "#475569" },
      },
      {
        id: "e4-5",
        source: "dispatch_task",
        target: "validation_node",
        animated: activeNode === "validation_node",
        style: { stroke: nodeStatuses["dispatch_task"] === "completed" ? "#10b981" : "#475569", strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: nodeStatuses["dispatch_task"] === "completed" ? "#10b981" : "#475569" },
      },
      {
        id: "e5-6",
        source: "validation_node",
        target: "hitl_approval_gate",
        animated: activeNode === "hitl_approval_gate",
        style: { stroke: nodeStatuses["validation_node"] === "completed" ? "#10b981" : "#475569", strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: nodeStatuses["validation_node"] === "completed" ? "#10b981" : "#475569" },
      },
      {
        id: "e6-7",
        source: "hitl_approval_gate",
        target: "commit_telemetry",
        animated: activeNode === "commit_telemetry",
        style: { stroke: nodeStatuses["hitl_approval_gate"] === "completed" ? "#10b981" : "#475569", strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: nodeStatuses["hitl_approval_gate"] === "completed" ? "#10b981" : "#475569" },
      },
      // Retry Loop Edge (validation_node -> dispatch_task)
      {
        id: "e5-4-retry",
        source: "validation_node",
        target: "dispatch_task",
        animated: nodeStatuses["validation_node"] === "retry",
        label: "Retry Loop (Max 3)",
        labelStyle: { fill: "#f97316", fontSize: 10, fontFamily: "monospace" },
        style: {
          stroke: nodeStatuses["validation_node"] === "retry" ? "#f97316" : "#334155",
          strokeWidth: 2,
          strokeDasharray: "4,4",
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: nodeStatuses["validation_node"] === "retry" ? "#f97316" : "#334155" },
      },
    ];
    return defaultEdges;
  }, [nodeStatuses, activeNode]);

  return (
    <div className="w-full h-[320px] bg-slate-950/60 rounded-xl border border-slate-800 overflow-hidden relative shadow-inner">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => onNodeClick && onNodeClick(node.id)}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.4}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#334155" gap={16} size={1} />
        <Controls className="!bg-slate-900 !border !border-slate-700 !fill-slate-300" />
      </ReactFlow>
    </div>
  );
};
