import express, { Request, Response } from 'express';
import cors from 'cors';
import { authTenantMiddleware, AuthenticatedTenantRequest } from './middleware/authTenant';
import { sanitizePayloadMiddleware } from './middleware/sanitizePayload';
import {
  getTenantRegistry,
  getSessionsStore,
  getEventsStore,
  getFirestoreDb,
  recordAuditEvent,
  loadStateFromFirestore,
  SessionDoc,
  AuditEventDoc
} from './store';
import { reapStaleSessions, reapStaleSessionsAsync, startReaperScheduler, TIMEOUT_THRESHOLD_MS } from './services/sessionReaper';

const app = express();
const PORT = process.env.PORT || 8080;

// Enable CORS for web console and spoke apps
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-spoke-token', 'x-spoke-app-id']
  })
);

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Liveness & Readiness probe
app.get('/api/v1/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'spokeops-ingestion',
    version: '1.0.0',
    standard: 'Hub-Spoke',
    timestamp: new Date().toISOString()
  });
});

/**
 * Master Ingestion Endpoint: POST /api/v1/telemetry
 * Handles session_start, heartbeat, session_end, and audit_event.
 */
app.post(
  '/api/v1/telemetry',
  authTenantMiddleware,
  sanitizePayloadMiddleware,
  (req: AuthenticatedTenantRequest, res: Response) => {
    const {
      type,
      sessionId,
      appId,
      userId,
      userEmail,
      userRoles,
      clientMetadata,
      durationSeconds,
      auditEvent,
      timestamp
    } = req.body;

    if (!sessionId || !type) {
      res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'sessionId and type are required in telemetry payload'
      });
      return;
    }

    const sessions = getSessionsStore();
    const nowIso = timestamp || new Date().toISOString();

    // Client IP resolution (from X-Forwarded-For or socket, fallback to payload or loopback)
    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      clientMetadata?.ipAddress ||
      '127.0.0.1';

    const mergedMetadata = {
      userAgent: clientMetadata?.userAgent || 'Unknown Agent',
      browser: clientMetadata?.browser || 'Unknown Browser',
      os: clientMetadata?.os || 'Unknown OS',
      ipAddress: clientIp,
      viewport: clientMetadata?.viewport || '1920x1080'
    };

    // Update or create session
    let existingSession = sessions.get(sessionId);
    const incomingStatus = (req.body.status as string) || (type === 'session_end' ? 'closed' : 'active');

    if (type === 'session_start' || !existingSession) {
      const newSession: SessionDoc = {
        sessionId,
        appId: req.tenantAppId || appId,
        userId: userId || 'anonymous',
        userEmail: userEmail || 'unknown@domain.com',
        userRoles: Array.isArray(userRoles) ? userRoles : ['viewer'],
        startedAt: existingSession ? existingSession.startedAt : nowIso,
        lastHeartbeat: nowIso,
        durationSeconds: durationSeconds || 0,
        status: (incomingStatus === 'closed' ? 'closed' : (incomingStatus === 'idle' ? 'idle' : 'active')) as any,
        clientMetadata: mergedMetadata
      };
      sessions.set(sessionId, newSession);
    } else if (type === 'heartbeat' || type === 'session_heartbeat') {
      existingSession.lastHeartbeat = nowIso;
      existingSession.durationSeconds = durationSeconds ?? existingSession.durationSeconds + 120;
      existingSession.status = (incomingStatus === 'closed' ? 'closed' : (incomingStatus === 'idle' ? 'idle' : 'active')) as any;
      existingSession.clientMetadata = { ...existingSession.clientMetadata, ...mergedMetadata };
      sessions.set(sessionId, existingSession);
    } else if (type === 'session_end') {
      existingSession.status = 'closed';
      existingSession.lastHeartbeat = nowIso;
      existingSession.durationSeconds = durationSeconds ?? existingSession.durationSeconds;
      sessions.set(sessionId, existingSession);
    }

    // Process audit event if present (supports nested auditEvent or flat body)
    if (type === 'audit_event') {
      const auditData = auditEvent || req.body;
      const events = getEventsStore();
      const eventDoc: AuditEventDoc = {
        eventId: auditData.eventId || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        appId: req.tenantAppId || appId,
        sessionId,
        userId: userId || 'anonymous',
        userEmail: userEmail || 'unknown@domain.com',
        roleAtExecution: auditData.roleAtExecution || userRoles?.[0] || 'viewer',
        action: auditData.action,
        resourceType: auditData.resourceType,
        resourceId: auditData.resourceId,
        status: auditData.status,
        metadata: auditData.metadata || {},
        timestamp: auditData.timestamp || nowIso
      };
      recordAuditEvent(eventDoc);
    }

    res.status(200).json({
      acknowledged: true,
      sessionId,
      type,
      serverTimestamp: new Date().toISOString()
    });
  }
);

/**
 * Tenant Registry: GET /api/v1/tenants
 */
app.get('/api/v1/tenants', (_req: Request, res: Response) => {
  const registry = getTenantRegistry();
  const tenants = Array.from(registry.values());
  res.json({ tenants });
});

function getRangeTimeLimitMs(range?: string): number | null {
  if (!range || range === 'ALL') return null;
  switch (range) {
    case '15m': return 15 * 60 * 1000;
    case '1h': return 60 * 60 * 1000;
    case '24h': return 24 * 60 * 60 * 1000;
    case '7d': return 7 * 24 * 60 * 60 * 1000;
    case '30d': return 30 * 24 * 60 * 60 * 1000;
    default: return null;
  }
}

/**
 * Sessions Query: GET /api/v1/sessions
 */
app.get('/api/v1/sessions', async (req: Request, res: Response) => {
  const { appId, status, search, limit, range, cursor } = req.query;
  const db = getFirestoreDb();
  let list: SessionDoc[] = [];
  let indexUrl: string | null = null;

  const timeLimitMs = getRangeTimeLimitMs(range as string);

  if (db && process.env.NODE_ENV !== 'test') {
    try {
      let query: any = db.collection('sessions');
      if (appId && appId !== 'all') {
        query = query.where('appId', '==', appId);
      }
      if (status && status !== 'all') {
        query = query.where('status', '==', status);
      }
      if (timeLimitMs !== null) {
        const lowerBoundIso = new Date(Date.now() - timeLimitMs).toISOString();
        query = query.where('lastHeartbeat', '>=', lowerBoundIso);
      }

      // Strictly apply orderBy lastHeartbeat desc
      query = query.orderBy('lastHeartbeat', 'desc');

      if (cursor && typeof cursor === 'string') {
        query = query.startAfter(cursor);
      }

      const batchLimit = Math.min(Math.max(parseInt(limit as string, 10) || 50, 1), 100);
      const snapshot = await query.limit(batchLimit + 1).get();
      snapshot.forEach((doc: any) => {
        list.push(doc.data() as SessionDoc);
      });
    } catch (err: any) {
      if (err.message && (err.message.includes('requires an index') || err.message.includes('FAILED_PRECONDITION'))) {
        const urlMatch = err.message.match(/https:\/\/console\.firebase\.google\.com[^\s\)]+/);
        indexUrl = urlMatch ? urlMatch[0] : null;
        console.error('[SpokeOps API] Missing Firestore composite index for sessions query!');
        if (indexUrl) console.error(`  --> Create index here: ${indexUrl}`);
      } else {
        console.warn('[SpokeOps API] Firestore sessions query error:', err.message);
      }
    }
  }

  // Fallback to in-memory sessions if Firestore empty or offline
  if (list.length === 0) {
    const sessions = getSessionsStore();
    list = Array.from(sessions.values());

    if (appId && appId !== 'all') {
      list = list.filter((s) => s.appId === appId);
    }
  }

  // Evaluate real-time staleness dynamically:
  // If a session has not had a heartbeat within TIMEOUT_THRESHOLD_MS (6 minutes),
  // transition it from active/idle to timed_out and persist the update.
  const now = Date.now();
  const staleToPersist: SessionDoc[] = [];

  list = list.map((session) => {
    if (session.status === 'active' || session.status === 'idle') {
      const lastHeartbeatMs = new Date(session.lastHeartbeat).getTime();
      const elapsed = now - lastHeartbeatMs;

      if (elapsed > TIMEOUT_THRESHOLD_MS) {
        const timedOut: SessionDoc = { ...session, status: 'timed_out' };
        staleToPersist.push(timedOut);
        return timedOut;
      }
    }
    return session;
  });

  // Non-blocking asynchronous persistence of newly swept sessions
  if (staleToPersist.length > 0) {
    const sessions = getSessionsStore();
    for (const s of staleToPersist) {
      sessions.set(s.sessionId, s);
    }
  }

  // Filter by status AFTER dynamic staleness evaluation
  if (status && status !== 'all') {
    list = list.filter((s) => s.status === status);
  }

  // Filter by date range lower bound (for 30d, 7d, etc., or none for ALL)
  if (timeLimitMs !== null) {
    const lowerBoundMs = Date.now() - timeLimitMs;
    list = list.filter((s) => {
      const hb = new Date(s.lastHeartbeat).getTime();
      const st = new Date(s.startedAt).getTime();
      return hb >= lowerBoundMs || st >= lowerBoundMs;
    });
  }

  // Filter by search query (email, userId, sessionId)
  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    list = list.filter(
      (s) =>
        s.userEmail.toLowerCase().includes(q) ||
        s.userId.toLowerCase().includes(q) ||
        s.sessionId.toLowerCase().includes(q)
    );
  }

  // Strictly sort by lastHeartbeat desc
  list.sort((a, b) => new Date(b.lastHeartbeat).getTime() - new Date(a.lastHeartbeat).getTime());

  // In-memory cursor pagination
  let startIndex = 0;
  if (cursor && typeof cursor === 'string') {
    const foundIdx = list.findIndex((s) => s.sessionId === cursor || s.lastHeartbeat === cursor);
    if (foundIdx !== -1) {
      startIndex = foundIdx + 1;
    } else {
      const cursorTime = new Date(cursor).getTime();
      if (!isNaN(cursorTime)) {
        const timeIdx = list.findIndex((s) => new Date(s.lastHeartbeat).getTime() < cursorTime);
        if (timeIdx !== -1) startIndex = timeIdx;
      }
    }
  }

  const batchLimit = Math.min(Math.max(parseInt(limit as string, 10) || 50, 1), 100);
  const sliced = list.slice(startIndex, startIndex + batchLimit + 1);
  const hasMore = sliced.length > batchLimit;
  const items = hasMore ? sliced.slice(0, batchLimit) : sliced;
  const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].lastHeartbeat : null;

  res.json({
    sessions: items,
    nextCursor,
    total: list.length,
    hasMore,
    range: range || '24h',
    indexUrl
  });
});

/**
 * Disconnect/Evict Session: POST /api/v1/sessions/disconnect
 * Permitted for Ops Admin
 */
app.post('/api/v1/sessions/disconnect', async (req: Request, res: Response) => {
  const { sessionId, reason } = req.body;
  if (!sessionId) {
    res.status(400).json({ error: 'MISSING_SESSION_ID', message: 'sessionId is required' });
    return;
  }

  const sessions = getSessionsStore();
  let session = sessions.get(sessionId);

  // If not found in memory, look up directly in Firestore
  if (!session) {
    const db = getFirestoreDb();
    if (db && process.env.NODE_ENV !== 'test') {
      try {
        const doc = await db.doc(`sessions/${sessionId}`).get();
        if (doc.exists) {
          session = doc.data() as SessionDoc;
        }
      } catch (err: any) {
        console.warn('[SpokeOps API] Firestore disconnect lookup failed:', err.message);
      }
    }
  }

  if (!session) {
    res.status(404).json({ error: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` });
    return;
  }

  session.status = 'closed';
  session.lastHeartbeat = new Date().toISOString();
  sessions.set(sessionId, session);

  // Log an audit event for the eviction
  recordAuditEvent({
    eventId: `evt_evict_${Date.now()}`,
    appId: session.appId,
    sessionId: session.sessionId,
    userId: 'ops_admin_console',
    userEmail: 'admin@spokeops.internal',
    roleAtExecution: 'ops_admin',
    action: 'role_revoke',
    resourceType: 'session_token',
    resourceId: sessionId,
    status: 'warning',
    metadata: {
      action: 'manual_session_disconnect',
      reason: reason || 'Administrative eviction by Ops Admin',
      evictedUser: session.userEmail
    },
    timestamp: new Date().toISOString()
  });

  res.json({
    success: true,
    sessionId,
    status: 'closed',
    message: `Session ${sessionId} has been evicted.`
  });
});

/**
 * Audit Events Query: GET /api/v1/events
 */
app.get('/api/v1/events', async (req: Request, res: Response) => {
  const { appId, status, action, search, limit, range, cursor } = req.query;
  const db = getFirestoreDb();
  let list: AuditEventDoc[] = [];
  let indexUrl: string | null = null;

  const timeLimitMs = getRangeTimeLimitMs(range as string);

  if (db && process.env.NODE_ENV !== 'test') {
    try {
      let query: any = db.collection('events');
      if (appId && appId !== 'all') {
        query = query.where('appId', '==', appId);
      }
      if (status && status !== 'all') {
        query = query.where('status', '==', status);
      }
      if (action && action !== 'all') {
        query = query.where('action', '==', action);
      }
      if (timeLimitMs !== null) {
        const lowerBoundIso = new Date(Date.now() - timeLimitMs).toISOString();
        query = query.where('timestamp', '>=', lowerBoundIso);
      }

      // Strictly apply orderBy timestamp desc
      query = query.orderBy('timestamp', 'desc');

      if (cursor && typeof cursor === 'string') {
        query = query.startAfter(cursor);
      }

      const batchLimit = Math.min(Math.max(parseInt(limit as string, 10) || 50, 1), 100);
      const snapshot = await query.limit(batchLimit + 1).get();
      snapshot.forEach((doc: any) => {
        list.push(doc.data() as AuditEventDoc);
      });
    } catch (err: any) {
      if (err.message && (err.message.includes('requires an index') || err.message.includes('FAILED_PRECONDITION'))) {
        const urlMatch = err.message.match(/https:\/\/console\.firebase\.google\.com[^\s\)]+/);
        indexUrl = urlMatch ? urlMatch[0] : null;
        console.error('[SpokeOps API] Missing Firestore composite index for events query!');
        if (indexUrl) console.error(`  --> Create index here: ${indexUrl}`);
      } else {
        console.warn('[SpokeOps API] Firestore events query error:', err.message);
      }
    }
  }

  if (list.length === 0) {
    const events = getEventsStore();
    list = [...events];

    if (appId && appId !== 'all') {
      list = list.filter((e) => e.appId === appId);
    }

    if (status && status !== 'all') {
      list = list.filter((e) => e.status === status);
    }

    if (action && action !== 'all') {
      list = list.filter((e) => e.action === action);
    }
  }

  // Filter by date range lower bound (e.g. 30d, 7d, or unbounded for ALL)
  if (timeLimitMs !== null) {
    const lowerBoundMs = Date.now() - timeLimitMs;
    list = list.filter((e) => new Date(e.timestamp).getTime() >= lowerBoundMs);
  }

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    list = list.filter(
      (e) =>
        e.userEmail.toLowerCase().includes(q) ||
        e.userId.toLowerCase().includes(q) ||
        e.resourceId.toLowerCase().includes(q) ||
        e.resourceType.toLowerCase().includes(q) ||
        e.eventId.toLowerCase().includes(q)
    );
  }

  // Strictly order by timestamp desc
  list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // In-memory cursor pagination
  let startIndex = 0;
  if (cursor && typeof cursor === 'string') {
    const foundIdx = list.findIndex((e) => e.eventId === cursor || e.timestamp === cursor);
    if (foundIdx !== -1) {
      startIndex = foundIdx + 1;
    } else {
      const cursorTime = new Date(cursor).getTime();
      if (!isNaN(cursorTime)) {
        const timeIdx = list.findIndex((e) => new Date(e.timestamp).getTime() < cursorTime);
        if (timeIdx !== -1) startIndex = timeIdx;
      }
    }
  }

  const batchLimit = Math.min(Math.max(parseInt(limit as string, 10) || 50, 1), 100);
  const sliced = list.slice(startIndex, startIndex + batchLimit + 1);
  const hasMore = sliced.length > batchLimit;
  const items = hasMore ? sliced.slice(0, batchLimit) : sliced;
  const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].timestamp : null;

  res.json({
    events: items,
    nextCursor,
    total: list.length,
    hasMore,
    range: range || 'ALL',
    indexUrl
  });
});

/**
 * Scheduled Reaper Webhook: POST /api/v1/reap-sessions
 */
app.post('/api/v1/reap-sessions', async (_req: Request, res: Response) => {
  const result = await reapStaleSessionsAsync();
  res.json({
    success: true,
    result
  });
});

// Start server and initialize 5-minute background reaper scheduler only if executed directly
let server: any;
if (process.env.NODE_ENV !== 'test' && (!process.argv[1] || process.argv[1].includes('server/index'))) {
  server = app.listen(PORT, async () => {
    console.log(`[SpokeOps Ingestion API] Server running on http://localhost:${PORT}`);
    startReaperScheduler(5 * 60 * 1000);
    try {
      await loadStateFromFirestore();
    } catch (err: any) {
      console.warn('[SpokeOps Ingestion API] Initial state load failure:', err.message);
    }
  });
}

export default app;
export { server };
