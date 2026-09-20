import { getSessionsStore, SessionDoc } from '../store';

export interface ReaperResult {
  sweptCount: number;
  timedOutSessionIds: string[];
  reapedAt: string;
}

const TIMEOUT_THRESHOLD_MS = 6 * 60 * 1000; // 6 minutes threshold

/**
 * Reaps active or idle sessions whose lastHeartbeat is older than 6 minutes,
 * transitioning their status to 'timed_out'.
 */
export function reapStaleSessions(): ReaperResult {
  const sessions = getSessionsStore();
  const now = Date.now();
  const timedOutSessionIds: string[] = [];

  for (const [sessionId, session] of sessions.entries()) {
    if (session.status === 'active' || session.status === 'idle') {
      const lastHeartbeatMs = new Date(session.lastHeartbeat).getTime();
      const elapsed = now - lastHeartbeatMs;

      if (elapsed > TIMEOUT_THRESHOLD_MS) {
        session.status = 'timed_out';
        timedOutSessionIds.push(sessionId);
      }
    }
  }

  const result: ReaperResult = {
    sweptCount: timedOutSessionIds.length,
    timedOutSessionIds,
    reapedAt: new Date().toISOString()
  };

  if (timedOutSessionIds.length > 0) {
    console.log(`[SpokeOps Reaper] Swept ${timedOutSessionIds.length} stale sessions:`, timedOutSessionIds);
  }

  return result;
}

/**
 * Starts periodic reaper interval (default every 5 minutes / 300,000ms)
 */
export function startReaperScheduler(intervalMs = 5 * 60 * 1000): NodeJS.Timeout {
  console.log(`[SpokeOps Reaper] Scheduled background reaper initialized with ${intervalMs / 1000}s interval.`);
  return setInterval(() => {
    try {
      reapStaleSessions();
    } catch (err) {
      console.error('[SpokeOps Reaper] Error during scheduled sweep:', err);
    }
  }, intervalMs);
}

// Standalone execution support for Cloud Scheduler / CLI
if (process.argv[1] && process.argv[1].endsWith('sessionReaper.ts')) {
  console.log('[SpokeOps Reaper] Executing on-demand session reaper sweep...');
  const res = reapStaleSessions();
  console.log('[SpokeOps Reaper] Sweep completed:', JSON.stringify(res, null, 2));
}
