import React, { useState } from "react";
import { Drawer } from "../common/Drawer.tsx";
import { WorkflowEvent } from "../../api/schemas.ts";
import { Badge } from "../common/Badge.tsx";
import { Terminal, Coins, Clock, ChevronRight, Filter } from "lucide-react";

interface LogStreamDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  events: WorkflowEvent[];
  sessionId: string | null;
  accumulatedTokens: number;
}

export const LogStreamDrawer: React.FC<LogStreamDrawerProps> = ({
  isOpen,
  onClose,
  events,
  sessionId,
  accumulatedTokens,
}) => {
  const [selectedEventIndex, setSelectedEventIndex] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<string>("all");

  const filteredEvents = events.filter((e) => {
    if (filterType === "all") return true;
    return e.type.includes(filterType);
  });

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      width="xl"
      title={
        <div className="flex items-center justify-between w-full pr-4">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-indigo-400" />
            <span>Telemetry & Event Stream</span>
          </div>
          <Badge variant="purple" className="font-mono">
            {sessionId?.slice(0, 14)}...
          </Badge>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Token and Metrics Ticker */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-center gap-3">
            <div className="p-2 rounded bg-indigo-500/10 text-indigo-400">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-400 uppercase font-mono">
                Accumulated Tokens
              </div>
              <div className="text-lg font-bold font-mono text-indigo-400">
                {accumulatedTokens.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-center gap-3">
            <div className="p-2 rounded bg-emerald-500/10 text-emerald-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-400 uppercase font-mono">
                Total Events
              </div>
              <div className="text-lg font-bold font-mono text-emerald-400">
                {events.length}
              </div>
            </div>
          </div>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-2 text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-slate-400">Filter:</span>
          {["all", "node", "hitl", "complete"].map((ft) => (
            <button
              key={ft}
              onClick={() => setFilterType(ft)}
              className={`px-2 py-0.5 rounded capitalize ${
                filterType === ft
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              {ft}
            </button>
          ))}
        </div>

        {/* Event List */}
        <div className="space-y-2 font-mono text-xs">
          {filteredEvents.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              No stream events received yet for this session.
            </div>
          ) : (
            filteredEvents.map((evt, idx) => {
              const isSelected = selectedEventIndex === idx;
              return (
                <div
                  key={idx}
                  onClick={() => setSelectedEventIndex(isSelected ? null : idx)}
                  className={`p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-slate-800 border-indigo-500"
                      : "bg-slate-950/60 border-slate-800/80 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">
                        {evt.timestamp ? new Date(evt.timestamp).toLocaleTimeString() : "--:--:--"}
                      </span>
                      <span
                        className={`font-semibold ${
                          evt.type.includes("error")
                            ? "text-rose-400"
                            : evt.type.includes("hitl")
                            ? "text-amber-400"
                            : "text-emerald-400"
                        }`}
                      >
                        [{evt.type}]
                      </span>
                      {evt.node && <span className="text-indigo-300">@{evt.node}</span>}
                    </div>
                    <ChevronRight
                      className={`w-3.5 h-3.5 text-slate-500 transition-transform ${
                        isSelected ? "rotate-90" : ""
                      }`}
                    />
                  </div>

                  {isSelected && (
                    <div className="mt-2 pt-2 border-t border-slate-800 text-[11px] overflow-x-auto text-slate-300 bg-slate-950 p-2 rounded">
                      <pre>{JSON.stringify(evt, null, 2)}</pre>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </Drawer>
  );
};
