import crypto from 'crypto';

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

function sha256(val: string): string {
  return crypto.createHash('sha256').update(val).digest('hex');
}

// In-Memory Storage Maps for Node server runtime
const tenantRegistry = new Map<string, TenantRegistryDoc>();
const sessionsStore = new Map<string, SessionDoc>();
const eventsStore: AuditEventDoc[] = [];

// Seed initial tenants
const seedTenants: TenantRegistryDoc[] = [
  {
    appId: 'academy-library',
    appName: 'Academy Library',
    environment: 'production',
    allowedOrigins: ['https://library.academy.edu', 'http://localhost:5173'],
    spokeTokenHash: sha256('spk_live_acadlib_99f2b84'),
    isActive: true,
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString()
  },
  {
    appId: 'academy-timeliner',
    appName: 'Academy Timeliner',
    environment: 'production',
    allowedOrigins: ['https://timeliner.academy.edu', 'http://localhost:5174'],
    spokeTokenHash: sha256('spk_live_acadtime_a71e402'),
    isActive: true,
    createdAt: new Date(Date.now() - 25 * 86400000).toISOString()
  },
  {
    appId: 'academy-builder',
    appName: 'Academy Builder',
    environment: 'staging',
    allowedOrigins: ['https://builder-staging.academy.edu', 'http://localhost:5175'],
    spokeTokenHash: sha256('spk_stg_acadbld_c38d991'),
    isActive: true,
    createdAt: new Date(Date.now() - 15 * 86400000).toISOString()
  },
  {
    appId: 'avventiq',
    appName: 'Avventiq Enterprise',
    environment: 'production',
    allowedOrigins: ['https://app.avventiq.com', 'http://localhost:3000'],
    spokeTokenHash: sha256('spk_live_avventiq_e554109'),
    isActive: true,
    createdAt: new Date(Date.now() - 40 * 86400000).toISOString()
  },
  {
    appId: 'hub-spoke-agent-platform',
    appName: 'Hub-Spoke Agent Platform',
    environment: 'production',
    allowedOrigins: ['https://hub-spoke-web-ui-60727530657.us-central1.run.app', 'http://localhost:5173', 'http://localhost:8080'],
    spokeTokenHash: sha256('spk_live_hubspoke_b82f109'),
    isActive: true,
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString()
  }
];

// Seed initial realistic sessions
const now = Date.now();
const seedSessions: SessionDoc[] = [
  {
    sessionId: 'sess_acadlib_01',
    appId: 'academy-library',
    userId: 'usr_sarah_44',
    userEmail: 'sarah.connor@academy.edu',
    userRoles: ['instructor', 'curriculum_lead'],
    startedAt: new Date(now - 42 * 60 * 1000).toISOString(),
    lastHeartbeat: new Date(now - 30 * 1000).toISOString(), // 30s ago -> active
    durationSeconds: 42 * 60,
    status: 'active',
    clientMetadata: {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
      browser: 'Google Chrome',
      os: 'macOS',
      ipAddress: '192.168.1.104',
      viewport: '1920x1080'
    }
  },
  {
    sessionId: 'sess_acadtime_02',
    appId: 'academy-timeliner',
    userId: 'usr_marcus_12',
    userEmail: 'marcus.vance@academy.edu',
    userRoles: ['curriculum_lead', 'scheduler'],
    startedAt: new Date(now - 118 * 60 * 1000).toISOString(),
    lastHeartbeat: new Date(now - 90 * 1000).toISOString(), // 90s ago -> active
    durationSeconds: 118 * 60,
    status: 'active',
    clientMetadata: {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0',
      browser: 'Microsoft Edge',
      os: 'Windows',
      ipAddress: '10.240.12.88',
      viewport: '2560x1440'
    }
  },
  {
    sessionId: 'sess_acadbld_03',
    appId: 'academy-builder',
    userId: 'usr_elena_89',
    userEmail: 'elena.rostova@academy.edu',
    userRoles: ['course_author'],
    startedAt: new Date(now - 15 * 60 * 1000).toISOString(),
    lastHeartbeat: new Date(now - 3 * 60 * 1000).toISOString(), // 3 min ago -> idle
    durationSeconds: 15 * 60,
    status: 'idle',
    clientMetadata: {
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:123.0) Gecko/20100101 Firefox/123.0',
      browser: 'Firefox',
      os: 'Linux',
      ipAddress: '172.16.4.15',
      viewport: '1440x900'
    }
  },
  {
    sessionId: 'sess_avventiq_04',
    appId: 'avventiq',
    userId: 'usr_alex_09',
    userEmail: 'alex.chen@avventiq.com',
    userRoles: ['enterprise_admin', 'security_auditor'],
    startedAt: new Date(now - 85 * 60 * 1000).toISOString(),
    lastHeartbeat: new Date(now - 450 * 1000).toISOString(), // 7.5 min ago -> timed_out
    durationSeconds: 85 * 60,
    status: 'timed_out',
    clientMetadata: {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3_1) AppleWebKit/605.1.15 Version/17.3 Safari/605.1.15',
      browser: 'Safari',
      os: 'macOS',
      ipAddress: '198.51.100.42',
      viewport: '1728x1117'
    }
  },
  {
    sessionId: 'sess_avventiq_05',
    appId: 'avventiq',
    userId: 'usr_jordan_77',
    userEmail: 'jordan.lee@avventiq.com',
    userRoles: ['operator'],
    startedAt: new Date(now - 240 * 60 * 1000).toISOString(),
    lastHeartbeat: new Date(now - 180 * 60 * 1000).toISOString(),
    durationSeconds: 60 * 60,
    status: 'closed',
    clientMetadata: {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36',
      browser: 'Google Chrome',
      os: 'Windows',
      ipAddress: '203.0.113.19',
      viewport: '1920x1080'
    }
  }
];

// Seed initial realistic audit events
const seedEvents: AuditEventDoc[] = [
  {
    eventId: 'evt_sec_991',
    appId: 'academy-timeliner',
    sessionId: 'sess_acadtime_02',
    userId: 'usr_marcus_12',
    userEmail: 'marcus.vance@academy.edu',
    roleAtExecution: 'scheduler',
    action: 'permission_denied',
    resourceType: 'curriculum_module',
    resourceId: 'mod_quantum_101',
    status: 'denied',
    metadata: {
      reason: 'Missing role permission: curriculum_director',
      attemptedAction: 'archive_module',
      requestedRole: 'curriculum_director',
      currentRoles: ['scheduler', 'curriculum_lead']
    },
    timestamp: new Date(now - 12 * 60 * 1000).toISOString()
  },
  {
    eventId: 'evt_sec_992',
    appId: 'academy-library',
    sessionId: 'sess_acadlib_01',
    userId: 'usr_sarah_44',
    userEmail: 'sarah.connor@academy.edu',
    roleAtExecution: 'instructor',
    action: 'resource_update',
    resourceType: 'curriculum_module',
    resourceId: 'mod_astrophysics_204',
    status: 'success',
    metadata: {
      changes: { syllabusRevision: 4, publishedStatus: 'live' },
      previousRevision: 3,
      approvedBy: 'curriculum_lead'
    },
    timestamp: new Date(now - 22 * 60 * 1000).toISOString()
  },
  {
    eventId: 'evt_sec_993',
    appId: 'avventiq',
    sessionId: 'sess_avventiq_04',
    userId: 'usr_alex_09',
    userEmail: 'alex.chen@avventiq.com',
    roleAtExecution: 'enterprise_admin',
    action: 'role_grant',
    resourceType: 'tenant_user',
    resourceId: 'usr_jordan_77',
    status: 'success',
    metadata: {
      grantedRole: 'operator',
      tenantId: 'avventiq',
      authGrantor: 'alex.chen@avventiq.com',
      justification: 'Onboarding support engineer shift'
    },
    timestamp: new Date(now - 65 * 60 * 1000).toISOString()
  },
  {
    eventId: 'evt_sec_994',
    appId: 'academy-builder',
    sessionId: 'sess_acadbld_03',
    userId: 'usr_elena_89',
    userEmail: 'elena.rostova@academy.edu',
    roleAtExecution: 'course_author',
    action: 'resource_create',
    resourceType: 'course_unit',
    resourceId: 'unit_fluid_dynamics_01',
    status: 'success',
    metadata: {
      title: 'Introduction to Navier-Stokes Equations',
      contentType: 'interactive_lab',
      assetCount: 14
    },
    timestamp: new Date(now - 14 * 60 * 1000).toISOString()
  },
  {
    eventId: 'evt_sec_995',
    appId: 'avventiq',
    sessionId: 'sess_avventiq_05',
    userId: 'usr_jordan_77',
    userEmail: 'jordan.lee@avventiq.com',
    roleAtExecution: 'operator',
    action: 'logout',
    resourceType: 'tenant_user',
    resourceId: 'usr_jordan_77',
    status: 'success',
    metadata: {
      logoutType: 'explicit_user_action',
      sessionDurationMinutes: 60
    },
    timestamp: new Date(now - 180 * 60 * 1000).toISOString()
  },
  {
    eventId: 'evt_sec_996',
    appId: 'academy-timeliner',
    sessionId: 'sess_acadtime_02',
    userId: 'usr_marcus_12',
    userEmail: 'marcus.vance@academy.edu',
    roleAtExecution: 'scheduler',
    action: 'resource_update',
    resourceType: 'event_schedule',
    resourceId: 'sch_fall_2026_finals',
    status: 'warning',
    metadata: {
      conflictDetected: true,
      conflictingRoom: 'Auditorium A',
      warningDetail: 'Room double-booked with Physics Dept seminar'
    },
    timestamp: new Date(now - 5 * 60 * 1000).toISOString()
  }
];

// Initialize store with seeds
export function initializeStore(): void {
  seedTenants.forEach((t) => tenantRegistry.set(t.appId, { ...t }));
  seedSessions.forEach((s) => sessionsStore.set(s.sessionId, { ...s }));
  seedEvents.forEach((e) => eventsStore.push({ ...e }));
}

// Accessors
export function getTenantRegistry(): Map<string, TenantRegistryDoc> {
  if (tenantRegistry.size === 0) {
    initializeStore();
  }
  return tenantRegistry;
}

export function getSessionsStore(): Map<string, SessionDoc> {
  if (sessionsStore.size === 0) {
    initializeStore();
  }
  return sessionsStore;
}

export function getEventsStore(): AuditEventDoc[] {
  if (eventsStore.length === 0) {
    initializeStore();
  }
  return eventsStore;
}
