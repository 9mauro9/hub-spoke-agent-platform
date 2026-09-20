"""
FinOps Governance, Predictive Cost Control & Reconciliation for AES v3 Standard.
Computes pre-execution token/cost estimates and reconciles actual post-execution usage.
"""

from __future__ import annotations
import os
from typing import Dict, Any, List, Optional
from pydantic import BaseModel


# Pricing table in USD per 1 Million tokens (aligned with GCP Vertex AI Gemini pricing)
DEFAULT_PRICING_TABLE = {
    "gemini-1.5-pro": {
        "input_per_million": 3.50,
        "output_per_million": 10.50,
    },
    "gemini-1.5-flash": {
        "input_per_million": 0.075,
        "output_per_million": 0.30,
    },
    "gemini-2.0-flash": {
        "input_per_million": 0.10,
        "output_per_million": 0.40,
    },
}


class CostEstimate(BaseModel):
    model_name: str
    target_files_count: int
    total_characters: int
    estimated_input_tokens: int
    estimated_output_tokens: int
    estimated_total_tokens: int
    estimated_cost_usd: float


class ReconciledUsage(BaseModel):
    trace_id: str
    session_id: str
    spoke_id: str
    model_name: str
    estimated_tokens: int
    estimated_cost_usd: float
    actual_tokens: int
    actual_cost_usd: float
    token_variance: int
    cost_variance_usd: float
    accuracy_percentage: float
    duration_ms: int


class PreExecutionCostEstimator:
    """
    Computes upfront token consumption ceiling and projected financial cost
    before executing multi-step graph workflows.
    """

    def __init__(self, pricing_table: Optional[Dict[str, Dict[str, float]]] = None):
        self.pricing_table = pricing_table or DEFAULT_PRICING_TABLE

    def estimate_cost(
        self,
        target_files: List[str],
        base_dir: Optional[str] = None,
        model_name: str = "gemini-1.5-flash",
        task_prompt_length: int = 500,
    ) -> CostEstimate:
        total_chars = task_prompt_length
        found_files_count = 0

        for fpath in target_files:
            full_path = os.path.join(base_dir, fpath) if base_dir else fpath
            if os.path.isfile(full_path):
                try:
                    with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()
                        total_chars += len(content)
                        found_files_count += 1
                except Exception:
                    total_chars += 2000
            else:
                # Heuristic allocation for files not yet read or remote
                total_chars += 2000

        # Heuristic: ~4 characters per token in English/code
        est_input_tokens = max(100, int(total_chars / 4))
        # Heuristic: Output tokens ~30% of input or minimum 300
        est_output_tokens = max(300, int(est_input_tokens * 0.3))
        est_total_tokens = est_input_tokens + est_output_tokens

        pricing = self.pricing_table.get(
            model_name, self.pricing_table["gemini-1.5-flash"]
        )
        input_cost = (est_input_tokens / 1_000_000.0) * pricing["input_per_million"]
        output_cost = (est_output_tokens / 1_000_000.0) * pricing["output_per_million"]
        est_cost_usd = round(input_cost + output_cost, 6)

        return CostEstimate(
            model_name=model_name,
            target_files_count=len(target_files),
            total_characters=total_chars,
            estimated_input_tokens=est_input_tokens,
            estimated_output_tokens=est_output_tokens,
            estimated_total_tokens=est_total_tokens,
            estimated_cost_usd=est_cost_usd,
        )


class FinOpsReconciler:
    """
    Reconciles pre-execution estimates against actual token metrics post-execution,
    ready for persistence in Google Cloud Firestore.
    """

    def __init__(self, pricing_table: Optional[Dict[str, Dict[str, float]]] = None):
        self.pricing_table = pricing_table or DEFAULT_PRICING_TABLE

    def reconcile(
        self,
        estimate: CostEstimate,
        actual_tokens: int,
        duration_ms: int,
        trace_id: str,
        session_id: str,
        spoke_id: str,
    ) -> ReconciledUsage:
        pricing = self.pricing_table.get(
            estimate.model_name, self.pricing_table["gemini-1.5-flash"]
        )
        # Allocate actual tokens 70% input, 30% output for pricing calculation
        actual_input = int(actual_tokens * 0.7)
        actual_output = actual_tokens - actual_input
        actual_cost_usd = round(
            (actual_input / 1_000_000.0) * pricing["input_per_million"]
            + (actual_output / 1_000_000.0) * pricing["output_per_million"],
            6,
        )

        token_variance = actual_tokens - estimate.estimated_total_tokens
        cost_variance = round(actual_cost_usd - estimate.estimated_cost_usd, 6)

        denom = max(estimate.estimated_total_tokens, actual_tokens, 1)
        accuracy = round(max(0.0, 100.0 - (abs(token_variance) / denom * 100.0)), 2)

        return ReconciledUsage(
            trace_id=trace_id,
            session_id=session_id,
            spoke_id=spoke_id,
            model_name=estimate.model_name,
            estimated_tokens=estimate.estimated_total_tokens,
            estimated_cost_usd=estimate.estimated_cost_usd,
            actual_tokens=actual_tokens,
            actual_cost_usd=actual_cost_usd,
            token_variance=token_variance,
            cost_variance_usd=cost_variance,
            accuracy_percentage=accuracy,
            duration_ms=duration_ms,
        )
