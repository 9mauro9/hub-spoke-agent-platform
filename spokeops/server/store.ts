import crypto from 'crypto';
import { Firestore } from '@google-cloud/firestore';

export interface TenantRegistryDoc {
  appId: string;
  appName: string;
  environment: 'production' | 'staging' | 'development';
  allowedOrigins: string[];
  spokeTokenHash: string;
  isActive: boolean;
  createdAt: string;
}

export interface SessionDoc {
  sessionId: string;
  appId: string;
  userId: string;
  userEmail: string;
  userRoles: string[];
  startedAt: string;
  lastHeartbeat: string;
  durationSeconds: number;
  status: 'active' | 'idle' | 'closed' | 'timed_out';
  clientMetadata: {
    userAgent: string;
    browser: string;
    os: string;
    ipAddress: string;
    viewport: string;
  };
}

export interface AuditEventDoc {
  eventId: string;
  appId: string;
  sessionId: string;
  userId: string;
  userEmail: string;
  roleAtExecution: string;
  action:
    | 'login'
    | 'logout'
    | 'agent_task_started'
    | 'agent_task_executed'
    | 'agent_task_failed'
    | 'role_grant'
    | 'role_revoke'
    | 'policy_update'
    | 'resource_create'
    | 'resource_update'
    | 'resource_delete'
    | 'permission_denied';
  resourceType: string;
  resourceId: string;
  status: 'success' | 'warning' | 'denied';
  metadata: Record<string, any>;
  timestamp: string;
}

export function sha256(val: string): string {
  return crypto.createHash('sha256').update(val).digest('hex');
}

// Firestore Database Client (graceful fallback in test/offline environments)
let firestoreDb: Firestore | null = null;
const GCP_PROJECT = process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'spokeops-509217';

try {
  if (process.env.NODE_ENV !== 'test') {
    firestoreDb = new Firestore({ projectId: GCP_PROJECT });
    console.log(`[SpokeOps Store] Initialized Cloud Firestore client for project '${GCP_PROJECT}'`);
  }
} catch (err: any) {
  console.warn('[SpokeOps Store] Running in memory-only mode. Firestore error:', err.message);
  firestoreDb = null;
}

export function getFirestoreDb(): Firestore | null {
  return firestoreDb;
}

/**
 * Observable Map that triggers Firestore synchronization upon mutations
 */
class ObservableSessionMap extends Map<string, SessionDoc> {
  public isHydrating = false;

  override set(key: string, value: SessionDoc): this {
    super.set(key, value);
    if (!this.isHydrating) {
      persistSessionToFirestore(value).catch((err) => {
        if (process.env.NODE_ENV !== 'test') {
          console.warn(`[SpokeOps Store] Non-blocking Firestore session sync failure for ${key}:`, err.message);
        }
      });
    }
    return this;
  }
}

// In-Memory Storage Maps for Node server runtime
const tenantRegistry = new Map<string, TenantRegistryDoc>();
const sessionsStore = new ObservableSessionMap();
const eventsStore: AuditEventDoc[] = [];

// Seed all authorized multi-tenant initiatives (AES v3 Standard)
export const seedTenants: TenantRegistryDoc[] = [
  {
    appId: 'academy-library',
    appName: 'Academy Library',
    environment: 'production',
    allowedOrigins: [
      'https://library.academy.edu',
      'https://academy-library.web.app',
      'https://academy-library.firebaseapp.com',
      'http://localhost:5173'
    ],
    spokeTokenHash: sha256('spk_live_acadlib_99f2b84'),
    isActive: true,
    createdAt: '2026-08-20T00:00:00.000Z'
  },
  {
    appId: 'academy-timeliner',
    appName: 'Academy Timeliner',
    environment: 'production',
    allowedOrigins: [
      'https://timeliner.academy.edu',
      'https://academy-timeliner.web.app',
      'https://academy-timeliner.firebaseapp.com',
      'http://localhost:5174',
      'http://localhost:5173'
    ],
    spokeTokenHash: sha256('spk_live_acadtime_a71e402'),
    isActive: true,
    createdAt: '2026-08-25T00:00:00.000Z'
  },
  {
    appId: 'academy-toolkit',
    appName: 'Academy Toolkit',
    environment: 'production',
    allowedOrigins: [
      'https://toolkit.academy.edu',
      'https://academy-toolkit.web.app',
      'https://academy-toolkit.firebaseapp.com',
      'http://localhost:5173',
      'http://localhost:3000'
    ],
    spokeTokenHash: sha256('spk_live_acadtool_e81c701'),
    isActive: true,
    createdAt: '2026-08-25T00:00:00.000Z'
  },
  {
    appId: 'academy-builder',
    appName: 'Academy Builder',
    environment: 'staging',
    allowedOrigins: [
      'https://builder-staging.academy.edu',
      'https://academy-builder.web.app',
      'https://academy-builder.firebaseapp.com',
      'http://localhost:5175'
    ],
    spokeTokenHash: sha256('spk_stg_acadbld_c38d991'),
    isActive: true,
    createdAt: '2026-09-05T00:00:00.000Z'
  },
  {
    appId: 'academy-insight',
    appName: 'Academy Insight',
    environment: 'production',
    allowedOrigins: [
      'https://insight.academy.edu',
      'https://academy-insight.web.app',
      'https://academy-insight.firebaseapp.com',
      'http://localhost:5173'
    ],
    spokeTokenHash: sha256('spk_live_acadins_f42d815'),
    isActive: true,
    createdAt: '2026-09-05T00:00:00.000Z'
  },
  {
    appId: 'avventiq',
    appName: 'Avventiq Enterprise',
    environment: 'production',
    allowedOrigins: [
      'https://avventiq.com',
      'https://www.avventiq.com',
      'https://app.avventiq.com',
      'https://avventiq.web.app',
      'https://avventiq.firebaseapp.com',
      'http://localhost:3000'
    ],
    spokeTokenHash: sha256('spk_live_avventiq_e554109'),
    isActive: true,
    createdAt: '2026-08-10T00:00:00.000Z'
  },
  {
    appId: 'hub-spoke-agent-platform',
    appName: 'Hub-Spoke Agent Platform',
    environment: 'production',
    allowedOrigins: [
      'https://hub-spoke-web-ui-60727530657.us-central1.run.app',
      'http://localhost:5173',
      'http://localhost:8080'
    ],
    spokeTokenHash: sha256('spk_live_hubspoke_b82f109'),
    isActive: true,
    createdAt: '2026-09-10T00:00:00.000Z'
  }
];

// No fake sessions or fake events - only live operational data
export const seedSessions: SessionDoc[] = [];
export const seedEvents: AuditEventDoc[] = [];

// ============================================================================
// Firestore Synchronization Functions
// ============================================================================

export async function persistSessionToFirestore(session: SessionDoc): Promise<void> {
  if (!firestoreDb) return;
  const data = { ...session };
  const batch = firestoreDb.batch();

  // 1. Write to tenant subcollection: /tenants/{appId}/sessions/{sessionId}
  const tenantDocRef = firestoreDb.doc(`tenants/${session.appId}/sessions/${session.sessionId}`);
  batch.set(tenantDocRef, data, { merge: true });

  // 2. Write to top-level collection: /sessions/{sessionId}
  const topDocRef = firestoreDb.doc(`sessions/${session.sessionId}`);
  batch.set(topDocRef, data, { merge: true });

  await batch.commit();
}

export async function persistEventToFirestore(event: AuditEventDoc): Promise<void> {
  if (!firestoreDb) return;
  const data = { ...event };
  const batch = firestoreDb.batch();

  // 1. Write to tenant subcollection: /tenants/{appId}/events/{eventId}
  const tenantEventRef = firestoreDb.doc(`tenants/${event.appId}/events/${event.eventId}`);
  batch.set(tenantEventRef, data);

  // 2. Write to top-level collection: /events/{eventId}
  const topEventRef = firestoreDb.doc(`events/${event.eventId}`);
  batch.set(topEventRef, data);

  await batch.commit();
}

export async function recordAuditEvent(eventDoc: AuditEventDoc): Promise<void> {
  eventsStore.unshift(eventDoc);
  try {
    await persistEventToFirestore(eventDoc);
  } catch (err: any) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(`[SpokeOps Store] Failed to persist audit event ${eventDoc.eventId}:`, err.message);
    }
  }
}

/**
 * Loads recent state and tenant definitions from Firestore
 */
export async function loadStateFromFirestore(): Promise<void> {
  if (!firestoreDb) return;

  try {
    // 1. Sync / load tenant registry
    for (const tenant of seedTenants) {
      await firestoreDb.doc(`tenants/${tenant.appId}`).set(tenant, { merge: true });
    }

    // 2. Load non-closed sessions (active, idle, timed_out) from Firestore /sessions
    sessionsStore.isHydrating = true;
    const sessionsSnapshot = await firestoreDb.collection('sessions').limit(200).get();
    for (const doc of sessionsSnapshot.docs) {
      const s = doc.data() as SessionDoc;
      sessionsStore.set(s.sessionId, s);
    }
    sessionsStore.isHydrating = false;

    // 3. Load recent 200 audit events from Firestore /events
    const eventsSnapshot = await firestoreDb.collection('events').limit(200).get();
    const loadedEvents: AuditEventDoc[] = [];
    for (const doc of eventsSnapshot.docs) {
      loadedEvents.push(doc.data() as AuditEventDoc);
    }
    loadedEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    // Clear and refill eventsStore
    eventsStore.length = 0;
    loadedEvents.forEach((e) => eventsStore.push(e));

    console.log(
      `[SpokeOps Store] Successfully restored ${sessionsStore.size} sessions and ${eventsStore.length} audit events from Cloud Firestore.`
    );
  } catch (err: any) {
    sessionsStore.isHydrating = false;
    console.warn('[SpokeOps Store] Could not restore state from Cloud Firestore:', err.message);
  }
}

// Initialize store with seeds and background Firestore sync
let isInitialized = false;
export function initializeStore(): void {
  if (isInitialized) return;
  isInitialized = true;

  // Populate local tenant map
  seedTenants.forEach((t) => tenantRegistry.set(t.appId, { ...t }));

  if (firestoreDb && process.env.NODE_ENV !== 'test') {
    loadStateFromFirestore().catch((err) => {
      console.warn('[SpokeOps Store] Async Firestore initialization error:', err.message);
    });
  }
}

// Accessors
export function getTenantRegistry(): Map<string, TenantRegistryDoc> {
  if (tenantRegistry.size === 0) {
    initializeStore();
  }
  return tenantRegistry;
}

export function getSessionsStore(): ObservableSessionMap {
  if (tenantRegistry.size === 0) {
    initializeStore();
  }
  return sessionsStore;
}

export function getEventsStore(): AuditEventDoc[] {
  if (tenantRegistry.size === 0) {
    initializeStore();
  }
  return eventsStore;
}
