import { getSessionsStore, getFirestoreDb, SessionDoc } from '../store';

export interface ReaperResult {
  sweptCount: number;
  timedOutSessionIds: string[];
  reapedAt: string;
}

export const TIMEOUT_THRESHOLD_MS = 6 * 60 * 1000; // 6 minutes threshold

/**
 * Reaps active or idle sessions whose lastHeartbeat is older than 6 minutes,
 * transitioning their status to 'timed_out' across both in-memory store and Cloud Firestore.
 */
export function reapStaleSessions(): ReaperResult {
  const sessions = getSessionsStore();
  const now = Date.now();
  const timedOutSessionIds: string[] = [];

  // 1. Sweep in-memory store
  for (const [sessionId, session] of sessions.entries()) {
    if (session.status === 'active' || session.status === 'idle') {
      const lastHeartbeatMs = new Date(session.lastHeartbeat).getTime();
      const elapsed = now - lastHeartbeatMs;

      if (elapsed > TIMEOUT_THRESHOLD_MS) {
        const updated: SessionDoc = { ...session, status: 'timed_out' };
        sessions.set(sessionId, updated); // ObservableSessionMap automatically calls persistSessionToFirestore!
        timedOutSessionIds.push(sessionId);
      }
    }
  }

  // 2. Trigger Firestore background sweep for sessions not in memory
  const db = getFirestoreDb();
  if (db && process.env.NODE_ENV !== 'test') {
    (async () => {
      try {
        const snapshot = await db.collection('sessions')
          .where('status', 'in', ['active', 'idle'])
          .limit(200)
          .get();

        const batch = db.batch();
        let batchCount = 0;

        snapshot.forEach((doc: any) => {
          const s = doc.data() as SessionDoc;
          const lastHeartbeatMs = new Date(s.lastHeartbeat).getTime();
          if (now - lastHeartbeatMs > TIMEOUT_THRESHOLD_MS) {
            batch.update(doc.ref, { status: 'timed_out' });
            if (s.appId) {
              const tenantDocRef = db.doc(`tenants/${s.appId}/sessions/${s.sessionId}`);
              batch.update(tenantDocRef, { status: 'timed_out' });
            }
            batchCount++;
          }
        });

        if (batchCount > 0) {
          await batch.commit();
          console.log(`[SpokeOps Reaper] Persisted ${batchCount} timed_out sessions to Cloud Firestore.`);
        }
      } catch (err: any) {
        console.warn('[SpokeOps Reaper] Firestore sweep warning:', err.message);
      }
    })().catch(() => {});
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
 * Asynchronous sweep that awaits Firestore batch commit.
 */
export async function reapStaleSessionsAsync(): Promise<ReaperResult> {
  const result = reapStaleSessions();
  const db = getFirestoreDb();
  if (db && process.env.NODE_ENV !== 'test') {
    try {
      const now = Date.now();
      const snapshot = await db.collection('sessions')
        .where('status', 'in', ['active', 'idle'])
        .limit(200)
        .get();

      const batch = db.batch();
      let extraCount = 0;

      snapshot.forEach((doc: any) => {
        const s = doc.data() as SessionDoc;
        const lastHeartbeatMs = new Date(s.lastHeartbeat).getTime();
        if (now - lastHeartbeatMs > TIMEOUT_THRESHOLD_MS) {
          if (!result.timedOutSessionIds.includes(s.sessionId)) {
            result.timedOutSessionIds.push(s.sessionId);
            extraCount++;
          }
          batch.update(doc.ref, { status: 'timed_out' });
          if (s.appId) {
            const tenantDocRef = db.doc(`tenants/${s.appId}/sessions/${s.sessionId}`);
            batch.update(tenantDocRef, { status: 'timed_out' });
          }
        }
      });

      if (extraCount > 0) {
        await batch.commit();
        result.sweptCount = result.timedOutSessionIds.length;
        console.log(`[SpokeOps Reaper] Async sweep updated ${extraCount} additional stale sessions in Firestore.`);
      }
    } catch (err: any) {
      console.warn('[SpokeOps Reaper] Firestore async sweep warning:', err.message);
    }
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
  reapStaleSessionsAsync().then((res) => {
    console.log('[SpokeOps Reaper] Sweep completed:', JSON.stringify(res, null, 2));
  });
}
