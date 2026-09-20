import React, { useState } from "react";
import { Modal } from "../common/Modal.tsx";
import { DiffViewer } from "./DiffViewer.tsx";
import { HitlActionControls } from "./HitlActionControls.tsx";
import { Badge } from "../common/Badge.tsx";
import { AlertOctagon } from "lucide-react";
import { api } from "../../api/client.ts";
import { useAuth } from "../../context/AuthContext.tsx";
import { spokeOps } from "@/telemetry/spokeOpsClient.ts";

interface HitlApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  payload: any;
  onDecisionSubmitted?: () => void;
}

export const HitlApprovalModal: React.FC<HitlApprovalModalProps> = ({
  isOpen,
  onClose,
  sessionId,
  payload,
  onDecisionSubmitted,
}) => {
  const { user, checkPermission } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const spokeResp = payload?.spoke_response?.result_payload || payload?.validation_result || {};
  const modifiedFiles = spokeResp.modified_files || [];
  const errorLogs = spokeResp.error_logs || payload?.error || null;
  const storageUri = spokeResp.storage_uri || null;
  const details = spokeResp.details || {};
  const slidingSummary = payload?.state?.sliding_context_summary || null;

  const handleApprove = async () => {
    if (!checkPermission("operator", "/hitl/approve")) {
      setErrorMessage("Permission Denied: Current RBAC role cannot approve tasks. Switch to Operator or Admin.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      await api.submitHitlDecision(sessionId, {
        action: "approve",
        approver_id: user.email,
        comments: `Approved via Web Management Dashboard by ${user.displayName}`,
      });

      // Emit policy_update audit event for HITL gate approval
      spokeOps.logAudit({
        action: "policy_update",
        resourceType: "hitl_approval_gate",
        resourceId: sessionId,
        status: "success",
        metadata: {
          decision: "approve",
          approverId: user.uid,
          approverEmail: user.email,
          modifiedFilesCount: modifiedFiles.length,
        },
      });

      if (onDecisionSubmitted) onDecisionSubmitted();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to submit approval");
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (reason: string) => {
    if (!checkPermission("operator", "/hitl/reject")) {
      setErrorMessage("Permission Denied: Current RBAC role cannot reject tasks. Switch to Operator or Admin.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      await api.submitHitlDecision(sessionId, {
        action: "reject",
        approver_id: user.email,
        comments: reason,
      });

      // Emit policy_update audit event for HITL gate rejection
      spokeOps.logAudit({
        action: "policy_update",
        resourceType: "hitl_approval_gate",
        resourceId: sessionId,
        status: "warning",
        metadata: {
          decision: "reject",
          reason,
          approverId: user.uid,
          approverEmail: user.email,
        },
      });

      if (onDecisionSubmitted) onDecisionSubmitted();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to submit rejection");
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = async (feedback: string) => {
    if (!checkPermission("operator", "/hitl/feedback")) {
      setErrorMessage("Permission Denied: Current RBAC role cannot inject feedback. Switch to Operator or Admin.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      await api.submitHitlDecision(sessionId, {
        action: "feedback",
        approver_id: user.email,
        feedback,
      });

      // Emit policy_update audit event for corrective feedback
      spokeOps.logAudit({
        action: "policy_update",
        resourceType: "hitl_approval_gate",
        resourceId: sessionId,
        status: "success",
        metadata: {
          decision: "feedback",
          feedbackLength: feedback.length,
          approverId: user.uid,
          approverEmail: user.email,
        },
      });

      if (onDecisionSubmitted) onDecisionSubmitted();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to submit feedback");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="4xl"
      title={
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
            <AlertOctagon className="w-5 h-5" />
          </div>
          <div>
            <div className="text-base font-bold text-slate-100 flex items-center gap-2">
              Human-in-the-Loop (HITL) Gate Active
              <Badge variant="warning" pulse>
                AWAITING APPROVAL
              </Badge>
            </div>
            <div className="text-xs text-slate-400 font-mono">
              Session: {sessionId}
            </div>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {errorMessage && (
          <div className="p-3 bg-rose-950/40 border border-rose-500 text-rose-300 text-xs rounded-lg">
            {errorMessage}
          </div>
        )}

        {/* Informational callout */}
        <div className="p-3.5 bg-slate-950/80 border border-amber-500/30 rounded-xl flex items-start gap-3">
          <div className="text-xs text-slate-300 leading-relaxed">
            <span className="text-amber-400 font-semibold">Governance Notice: </span>
            This multi-agent task paused at the <code className="text-indigo-300">hitl_approval_gate</code> per AES v3 standard.
            Review the synthesized outputs, schema validations, and proposed file modifications below before granting commit authority.
          </div>
        </div>

        {/* Diff & Artifact Viewer */}
        <DiffViewer
          modifiedFiles={modifiedFiles}
          errorLogs={errorLogs}
          storageUri={storageUri}
          details={details}
          slidingSummary={slidingSummary}
        />

        {/* Controls */}
        <div className="pt-2 border-t border-slate-800">
          <HitlActionControls
            onApprove={handleApprove}
            onReject={handleReject}
            onFeedback={handleFeedback}
            loading={loading}
          />
        </div>
      </div>
    </Modal>
  );
};
