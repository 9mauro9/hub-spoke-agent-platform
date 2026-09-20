import React, { useState } from "react";
import { FileCode, Check, Copy, Eye, Code } from "lucide-react";

interface DiffViewerProps {
  modifiedFiles?: string[];
  errorLogs?: string | null;
  details?: Record<string, any>;
  storageUri?: string | null;
  slidingSummary?: string | null;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  modifiedFiles = [],
  errorLogs,
  details = {},
  storageUri,
  slidingSummary,
}) => {
  const [activeTab, setActiveTab] = useState<"summary" | "files" | "raw">("summary");
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden font-mono text-xs">
      {/* Header Tabs */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4 text-indigo-400" />
          <span className="font-semibold text-slate-200">Execution Output & Diff Review</span>
        </div>

        <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
          <button
            onClick={() => setActiveTab("summary")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors ${
              activeTab === "summary"
                ? "bg-indigo-600 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Eye className="w-3.5 h-3.5" /> Summary
          </button>
          <button
            onClick={() => setActiveTab("files")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors ${
              activeTab === "files"
                ? "bg-indigo-600 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Code className="w-3.5 h-3.5" /> Files ({modifiedFiles.length})
          </button>
          <button
            onClick={() => setActiveTab("raw")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors ${
              activeTab === "raw"
                ? "bg-indigo-600 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Raw JSON
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-4 max-h-[360px] overflow-y-auto space-y-3">
        {activeTab === "summary" && (
          <div className="space-y-3 font-sans">
            {storageUri && (
              <div className="p-3 bg-indigo-950/30 border border-indigo-500/30 rounded-lg">
                <div className="text-xs text-indigo-300 font-semibold mb-1">
                  Cloud Storage Artifact Pointer:
                </div>
                <div className="text-xs font-mono text-indigo-200 break-all select-all bg-slate-950 p-2 rounded">
                  {storageUri}
                </div>
              </div>
            )}

            {slidingSummary && (
              <div className="p-3 bg-amber-950/20 border border-amber-500/30 rounded-lg">
                <div className="text-xs text-amber-300 font-semibold mb-1">
                  Sliding Context Window Error Compaction:
                </div>
                <div className="text-xs font-mono text-amber-200/90 whitespace-pre-wrap">
                  {slidingSummary}
                </div>
              </div>
            )}

            {errorLogs && (
              <div className="p-3 bg-rose-950/20 border border-rose-500/30 rounded-lg">
                <div className="text-xs text-rose-400 font-semibold mb-1">Validation Anomaly / Gate Notice:</div>
                <div className="text-xs font-mono text-rose-200 whitespace-pre-wrap">
                  {errorLogs}
                </div>
              </div>
            )}

            {/* Render details if available */}
            {Object.keys(details).length > 0 && (
              <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg">
                <div className="text-xs text-slate-300 font-semibold mb-2">Detailed Payload Metrics:</div>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  {Object.entries(details).map(([k, v]) => (
                    <div key={k} className="p-2 bg-slate-950 rounded border border-slate-800/80">
                      <span className="text-slate-400">{k}: </span>
                      <span className="text-slate-200 font-semibold">
                        {typeof v === "object" ? JSON.stringify(v) : String(v)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "files" && (
          <div className="space-y-1.5">
            {modifiedFiles.length === 0 ? (
              <div className="text-slate-500 text-center py-6">
                No files modified or deleted in this execution.
              </div>
            ) : (
              modifiedFiles.map((file, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2 rounded bg-slate-900/80 border border-slate-800 hover:border-slate-700"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">+</span>
                    <span className="text-slate-300">{file}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 uppercase px-1.5 py-0.5 rounded bg-slate-950">
                    Staged
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "raw" && (
          <div className="relative">
            <button
              onClick={() => copyToClipboard(JSON.stringify({ modifiedFiles, errorLogs, details, storageUri }, null, 2))}
              className="absolute top-2 right-2 p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
              title="Copy JSON"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <pre className="p-3 bg-slate-900 rounded-lg text-slate-300 overflow-x-auto text-[11px]">
              {JSON.stringify({ modifiedFiles, errorLogs, details, storageUri, slidingSummary }, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
