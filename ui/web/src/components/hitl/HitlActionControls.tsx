import React, { useState } from "react";
import { Button } from "../common/Button.tsx";
import { CheckCircle2, XCircle, MessageSquareShare } from "lucide-react";

interface HitlActionControlsProps {
  onApprove: () => Promise<void>;
  onReject: (reason: string) => Promise<void>;
  onFeedback: (feedback: string) => Promise<void>;
  loading?: boolean;
}

export const HitlActionControls: React.FC<HitlActionControlsProps> = ({
  onApprove,
  onReject,
  onFeedback,
  loading = false,
}) => {
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);

  const handleFeedbackSubmit = async () => {
    if (!feedbackText.trim()) return;
    await onFeedback(feedbackText);
    setFeedbackText("");
    setShowFeedbackInput(false);
  };

  const handleRejectSubmit = async () => {
    await onReject(rejectReason || "Rejected by human operator");
    setRejectReason("");
    setShowRejectInput(false);
  };

  return (
    <div className="space-y-3">
      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <Button
          variant="success"
          onClick={onApprove}
          loading={loading}
          icon={<CheckCircle2 className="w-4 h-4" />}
          className="flex-1"
        >
          Approve & Commit
        </Button>

        <Button
          variant="secondary"
          onClick={() => {
            setShowFeedbackInput(!showFeedbackInput);
            setShowRejectInput(false);
          }}
          disabled={loading}
          icon={<MessageSquareShare className="w-4 h-4 text-sky-400" />}
        >
          Corrective Feedback
        </Button>

        <Button
          variant="danger"
          onClick={() => {
            setShowRejectInput(!showRejectInput);
            setShowFeedbackInput(false);
          }}
          disabled={loading}
          icon={<XCircle className="w-4 h-4" />}
        >
          Reject
        </Button>
      </div>

      {/* Corrective Guidance Box */}
      {showFeedbackInput && (
        <div className="p-3 bg-slate-900 border border-sky-500/40 rounded-xl space-y-2 animate-in fade-in duration-200">
          <label className="text-xs font-semibold text-sky-300">
            Provide Human Steering Guidance (Injected into Sliding Context Retry Loop):
          </label>
          <textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="e.g. Please preserve the __pycache__ in virtualenv but clean project root..."
            rows={3}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
          />
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowFeedbackInput(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={handleFeedbackSubmit}
              loading={loading}
            >
              Inject Feedback & Retry
            </Button>
          </div>
        </div>
      )}

      {/* Reject Confirmation Box */}
      {showRejectInput && (
        <div className="p-3 bg-slate-900 border border-rose-500/40 rounded-xl space-y-2 animate-in fade-in duration-200">
          <label className="text-xs font-semibold text-rose-400">
            Rejection Reason (Recorded in Platform Audit Log):
          </label>
          <input
            type="text"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. Security boundary breach suspected..."
            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-rose-500 font-mono"
          />
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowRejectInput(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={handleRejectSubmit}
              loading={loading}
            >
              Confirm Rejection
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
