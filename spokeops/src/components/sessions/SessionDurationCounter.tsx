import React, { useState, useEffect } from 'react';

interface SessionDurationCounterProps {
  startedAt: string;
  initialDurationSeconds?: number;
  status: 'active' | 'idle' | 'closed' | 'timed_out';
}

export const SessionDurationCounter: React.FC<SessionDurationCounterProps> = ({
  startedAt,
  initialDurationSeconds = 0,
  status
}) => {
  const [seconds, setSeconds] = useState<number>(() => {
    if (status === 'closed' || status === 'timed_out') {
      return initialDurationSeconds;
    }
    const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
    return Math.max(elapsed, initialDurationSeconds);
  });

  useEffect(() => {
    // If session is closed or timed out, duration does not tick forward
    if (status === 'closed' || status === 'timed_out') {
      return;
    }

    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
      setSeconds(Math.max(elapsed, 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [startedAt, status]);

  const formatDuration = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    return `${minutes}m ${secs}s`;
  };

  return (
    <span className="font-mono text-xs text-slate-300 tabular-nums">
      {formatDuration(seconds)}
    </span>
  );
};
