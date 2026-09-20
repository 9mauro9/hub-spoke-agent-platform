import { TenantRegistryDoc, SessionDoc, AuditEventDoc } from '../types/telemetry';

const now = Date.now();

export const INITIAL_MOCK_TENANTS: TenantRegistryDoc[] = [
  {
    appId: 'academy-library',
    appName: 'Academy Library',
    environment: 'production',
    allowedOrigins: ['https://library.academy.edu', 'http://localhost:5173'],
    spokeTokenHash: '6d0a7a3b3a7db043e03194a8e2343ff27a518047970420fa225fb7ba714a601a',
    isActive: true,
    createdAt: new Date(now - 45 * 86400000).toISOString()
  },
  {
    appId: 'academy-timeliner',
    appName: 'Academy Timeliner',
    environment: 'production',
    allowedOrigins: ['https://timeliner.academy.edu', 'http://localhost:5174'],
    spokeTokenHash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
    isActive: true,
    createdAt: new Date(now - 30 * 86400000).toISOString()
  },
  {
    appId: 'academy-builder',
    appName: 'Academy Builder',
    environment: 'staging',
    allowedOrigins: ['https://builder-staging.academy.edu', 'http://localhost:5175'],
    spokeTokenHash: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
    isActive: true,
    createdAt: new Date(now - 14 * 86400000).toISOString()
  },
  {
    appId: 'avventiq',
    appName: 'Avventiq Enterprise',
    environment: 'production',
    allowedOrigins: ['https://app.avventiq.com', 'http://localhost:3000'],
    spokeTokenHash: 'ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d',
    isActive: true,
    createdAt: new Date(now - 60 * 86400000).toISOString()
  },
  {
    appId: 'hub-spoke-agent-platform',
    appName: 'Hub-Spoke Agent Platform',
    environment: 'production',
    allowedOrigins: ['https://hub-spoke-web-ui-60727530657.us-central1.run.app', 'http://localhost:5173', 'http://localhost:8080'],
    spokeTokenHash: 'c74b88e146743ebdf533e4bfa5889ff21b50d53cbf2b67d5ce390234a419ebc5',
    isActive: true,
    createdAt: new Date(now - 10 * 86400000).toISOString()
  }
];

export const INITIAL_MOCK_SESSIONS: SessionDoc[] = [
  {
    sessionId: 'sess_acadlib_01',
    appId: 'academy-library',
    userId: 'usr_sarah_44',
    userEmail: 'sarah.connor@academy.edu',
    userRoles: ['instructor', 'curriculum_lead'],
    startedAt: new Date(now - 42 * 60 * 1000).toISOString(),
    lastHeartbeat: new Date(now - 25 * 1000).toISOString(), // 25s ago -> active
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
    lastHeartbeat: new Date(now - 70 * 1000).toISOString(), // 70s ago -> active
    durationSeconds: 118 * 60,
    status: 'active',
    clientMetadata: {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edg/122.0.0.0',
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
  },
  {
    sessionId: 'sess_acadlib_06',
    appId: 'academy-library',
    userId: 'usr_david_55',
    userEmail: 'david.kim@academy.edu',
    userRoles: ['student_auditor'],
    startedAt: new Date(now - 5 * 60 * 1000).toISOString(),
    lastHeartbeat: new Date(now - 40 * 1000).toISOString(),
    durationSeconds: 5 * 60,
    status: 'active',
    clientMetadata: {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/122.0.0.0',
      browser: 'Google Chrome',
      os: 'macOS',
      ipAddress: '192.168.1.182',
      viewport: '1440x900'
    }
  },
  {
    sessionId: 'sess_hubspk_01',
    appId: 'hub-spoke-agent-platform',
    userId: 'usr_hub_op_01',
    userEmail: 'operator@hub-spoke.net',
    userRoles: ['platform_operator'],
    startedAt: new Date(now - 12 * 60 * 1000).toISOString(),
    lastHeartbeat: new Date(now - 15 * 1000).toISOString(), // 15s ago -> active
    durationSeconds: 12 * 60,
    status: 'active',
    clientMetadata: {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_0) AppleWebKit/537.36 Chrome/123.0.0.0 Safari/537.36',
      browser: 'Google Chrome',
      os: 'macOS',
      ipAddress: '192.168.1.55',
      viewport: '1920x1080'
    }
  }
];

export const INITIAL_MOCK_EVENTS: AuditEventDoc[] = [
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
      currentRoles: ['scheduler', 'curriculum_lead'],
      ipAddress: '10.240.12.88',
      timestamp: new Date(now - 12 * 60 * 1000).toISOString()
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
  },
  {
    eventId: 'evt_sec_997',
    appId: 'academy-library',
    sessionId: 'sess_acadlib_06',
    userId: 'usr_david_55',
    userEmail: 'david.kim@academy.edu',
    roleAtExecution: 'student_auditor',
    action: 'login',
    resourceType: 'auth_session',
    resourceId: 'sess_acadlib_06',
    status: 'success',
    metadata: {
      authProvider: 'Google Workspace SSO',
      mfaVerified: true
    },
    timestamp: new Date(now - 5 * 60 * 1000).toISOString()
  },
  {
    eventId: 'evt_hub_001',
    appId: 'hub-spoke-agent-platform',
    sessionId: 'sess_hubspk_01',
    userId: 'usr_hub_op_01',
    userEmail: 'operator@hub-spoke.net',
    roleAtExecution: 'platform_operator',
    action: 'agent_task_started',
    resourceType: 'agent_workflow',
    resourceId: 'sess_hubspk_01',
    status: 'success',
    metadata: {
      targetAgent: 'spoke-housekeeper',
      action: 'clean_repo_noise',
      sourceApp: 'core-hub',
      promptLength: 28
    },
    timestamp: new Date(now - 10 * 60 * 1000).toISOString()
  },
  {
    eventId: 'evt_hub_002',
    appId: 'hub-spoke-agent-platform',
    sessionId: 'sess_hubspk_01',
    userId: 'usr_hub_op_01',
    userEmail: 'operator@hub-spoke.net',
    roleAtExecution: 'platform_operator',
    action: 'agent_task_executed',
    resourceType: 'tool_dispatch',
    resourceId: 'analyzer_agent',
    status: 'success',
    metadata: {
      executionDurationMs: 412,
      tool: 'analyzer_agent',
      sessionId: 'sess_hubspk_01'
    },
    timestamp: new Date(now - 9 * 60 * 1000).toISOString()
  },
  {
    eventId: 'evt_hub_003',
    appId: 'hub-spoke-agent-platform',
    sessionId: 'sess_hubspk_01',
    userId: 'usr_hub_op_01',
    userEmail: 'operator@hub-spoke.net',
    roleAtExecution: 'admin',
    action: 'policy_update',
    resourceType: 'tenant_policy',
    resourceId: 'monthly_budget_cap_usd',
    status: 'success',
    metadata: {
      newBudgetCapUsd: 50.0,
      updatedBy: 'operator@hub-spoke.net',
      role: 'admin'
    },
    timestamp: new Date(now - 2 * 60 * 1000).toISOString()
  }
];

// In-browser mock state container
class BrowserMockStore {
  private tenants: TenantRegistryDoc[] = [...INITIAL_MOCK_TENANTS];
  private sessions: SessionDoc[] = [...INITIAL_MOCK_SESSIONS];
  private events: AuditEventDoc[] = [...INITIAL_MOCK_EVENTS];

  getTenants(): TenantRegistryDoc[] {
    return [...this.tenants];
  }

  getSessions(): SessionDoc[] {
    return [...this.sessions];
  }

  getEvents(): AuditEventDoc[] {
    return [...this.events];
  }

  disconnectSession(sessionId: string): boolean {
    const s = this.sessions.find((sess) => sess.sessionId === sessionId);
    if (!s) return false;
    s.status = 'closed';
    s.lastHeartbeat = new Date().toISOString();

    // Log an audit event
    this.events.unshift({
      eventId: `evt_evict_${Date.now()}`,
      appId: s.appId,
      sessionId: s.sessionId,
      userId: 'ops_admin_console',
      userEmail: 'admin@spokeops.internal',
      roleAtExecution: 'ops_admin',
      action: 'role_revoke',
      resourceType: 'session_token',
      resourceId: sessionId,
      status: 'warning',
      metadata: {
        action: 'manual_session_disconnect',
        reason: 'Evicted via SpokeOps Operations Console by Ops Admin',
        evictedUser: s.userEmail
      },
      timestamp: new Date().toISOString()
    });

    return true;
  }
}

export const browserMockStore = new BrowserMockStore();
