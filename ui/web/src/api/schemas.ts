import { z } from "zod";

/**
 * Zod Schemas adhering strictly to AES v3 Standard and Hub-and-Spoke contracts.
 */

export const TaskPayloadSchema = z.object({
  repository: z.string().min(1, "Repository is required"),
  branch: z.string().default("main").optional(),
  target_files: z.array(z.string()).min(1, "At least one target file is required"),
  storage_uri: z.string().url().optional().or(z.literal("")),
  context_metadata: z.record(z.any()).default({}),
});

export const AgentTaskRequestSchema = z.object({
  trace_id: z.string().uuid("trace_id must be a valid UUID"),
  session_id: z.string().min(1, "session_id is required"),
  source_app: z.enum(["academy-apps", "avventiq", "core-hub"]),
  target_spoke: z.string().min(1, "target_spoke is required"),
  action: z.string().min(1, "action is required"),
  payload: TaskPayloadSchema,
});

export const ExecutionMetricsSchema = z.object({
  duration_ms: z.number().int().nonnegative(),
  token_consumption: z.number().int().nonnegative(),
});

export const ResultPayloadSchema = z.object({
  modified_files: z.array(z.string()).default([]).optional(),
  storage_uri: z.string().optional().nullable(),
  error_logs: z.string().optional().nullable(),
  details: z.record(z.any()).default({}).optional(),
});

export const AgentTaskResponseSchema = z.object({
  trace_id: z.string().uuid(),
  session_id: z.string(),
  spoke_id: z.string(),
  status: z.enum(["success", "failure", "retry_required"]),
  execution_metrics: ExecutionMetricsSchema,
  result_payload: ResultPayloadSchema.default({}),
});

export const CostEstimateSchema = z.object({
  model_name: z.string(),
  target_files_count: z.number(),
  total_characters: z.number(),
  estimated_input_tokens: z.number(),
  estimated_output_tokens: z.number(),
  estimated_total_tokens: z.number(),
  estimated_cost_usd: z.number(),
  estimated_runtime_seconds: z.number().optional(),
  monthly_budget_cap_usd: z.number().optional(),
  exceeds_threshold: z.boolean().optional(),
  emergency_circuit_breaker_active: z.boolean().optional(),
});

export const SpokeActionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  parameters: z.array(
    z.object({
      name: z.string(),
      type: z.string(),
      required: z.boolean(),
      default: z.any().optional(),
      description: z.string().optional(),
    })
  ),
});

export const SpokeDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  status: z.enum(["Active", "Idle", "Offline", "Error"]),
  version: z.string(),
  mcp_endpoint: z.string(),
  actions: z.array(SpokeActionSchema),
  allowed_sources: z.array(z.string()),
});

export const FinopsTelemetryRecordSchema = z.object({
  session_id: z.string(),
  spoke_id: z.string(),
  source_app: z.string(),
  action: z.string(),
  actual_tokens: z.number(),
  actual_cost_usd: z.number(),
  estimated_cost_usd: z.number(),
  token_variance: z.number(),
  cost_variance_usd: z.number(),
  accuracy_percentage: z.number(),
  duration_ms: z.number(),
  status: z.string(),
  timestamp: z.string().optional().nullable(),
});

export const FinopsSummarySchema = z.object({
  total_tokens: z.number(),
  total_cost_usd: z.number(),
  total_estimated_cost_usd: z.number(),
  variance_cost_usd: z.number(),
  monthly_budget_cap_usd: z.number(),
  budget_utilized_percentage: z.number(),
  emergency_circuit_breaker_active: z.boolean(),
  halt_reason: z.string().optional().nullable(),
  domains: z.record(
    z.object({
      tokens: z.number(),
      cost_usd: z.number(),
      tasks: z.number(),
    })
  ),
  recent_telemetry: z.array(FinopsTelemetryRecordSchema),
  total_sessions: z.number(),
});

export const WorkflowEventSchema = z.object({
  session_id: z.string(),
  timestamp: z.string(),
  type: z.string(),
  node: z.string().optional(),
  status: z.string().optional(),
  state: z.record(z.any()).optional(),
  cost_estimate: z.record(z.any()).optional(),
  spoke_response: z.record(z.any()).optional(),
  validation_result: z.record(z.any()).optional(),
  reconciled_usage: z.record(z.any()).optional(),
  error: z.string().optional(),
  feedback: z.string().optional(),
  approver_id: z.string().optional(),
});

export type TaskPayload = z.infer<typeof TaskPayloadSchema>;
export type AgentTaskRequest = z.infer<typeof AgentTaskRequestSchema>;
export type AgentTaskResponse = z.infer<typeof AgentTaskResponseSchema>;
export type CostEstimate = z.infer<typeof CostEstimateSchema>;
export type SpokeDefinition = z.infer<typeof SpokeDefinitionSchema>;
export type SpokeAction = z.infer<typeof SpokeActionSchema>;
export type FinopsSummary = z.infer<typeof FinopsSummarySchema>;
export type FinopsTelemetryRecord = z.infer<typeof FinopsTelemetryRecordSchema>;
export type WorkflowEvent = z.infer<typeof WorkflowEventSchema>;
