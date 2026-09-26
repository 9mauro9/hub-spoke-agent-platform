process.env.NODE_ENV = 'test';
import assert from 'assert';
import http from 'http';
import app from '../server/index';
import { hashToken } from '../server/middleware/authTenant';
import { sanitizeObject } from '../server/middleware/sanitizePayload';
import { reapStaleSessions } from '../server/services/sessionReaper';
import { getSessionsStore, getEventsStore, getTenantRegistry, initializeStore } from '../server/store';

// Helper for making HTTP requests to in-memory Express server
function makeRequest(
  options: http.RequestOptions,
  body?: any
): Promise<{ status: number; data: any; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let rawData = '';
      res.on('data', (chunk) => {
        rawData += chunk;
      });
      res.on('end', () => {
        let parsed = rawData;
        try {
          parsed = JSON.parse(rawData);
        } catch (parseError: any) {
          // Payload is non-JSON or raw text; preserve rawData string
          parsed = rawData;
        }
        resolve({
          status: res.statusCode || 500,
          data: parsed,
          headers: res.headers
        });
      });
    });

    req.on('error', (err) => reject(err));

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runVerification() {
  console.log('\n======================================================');
  console.log('🚀 SPOKEOPS PLATFORM VERIFICATION (Hub-Spoke Standard)');
  console.log('======================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    totalTests++;
    return (async () => {
      try {
        await fn();
        console.log(`  ✅ [PASS] ${name}`);
        passedTests++;
      } catch (err: any) {
        console.error(`  ❌ [FAIL] ${name}`);
        console.error(`     Error: ${err.message}`);
        throw err;
      }
    })();
  }

  // Bind server to ephemeral port for testing
  const server = app.listen(0);
  const address = server.address() as any;
  const port = address.port;
  console.log(`[Test Server] Bound to ephemeral port: ${port}`);

  try {
    // ---------------------------------------------------------------
    // 1. Tenant Registry & Security Verification
    // ---------------------------------------------------------------
    console.log('\n--- 1. TENANT REGISTRY & AUTHENTICATION ---');

    await test('Initializes with standard seed tenants (Academy Apps, Avventiq, & Hub-Spoke Platform)', () => {
      const registry = getTenantRegistry();
      assert.strictEqual(registry.has('academy-library'), true);
      assert.strictEqual(registry.has('academy-timeliner'), true);
      assert.strictEqual(registry.has('academy-toolkit'), true);
      assert.strictEqual(registry.has('academy-builder'), true);
      assert.strictEqual(registry.has('academy-insight'), true);
      assert.strictEqual(registry.has('avventiq'), true);
      assert.strictEqual(registry.has('hub-spoke-agent-platform'), true);
      assert.strictEqual(registry.size, 7);
    });

    await test('Rejects telemetry ingestion without x-spoke-token (HTTP 401)', async () => {
      const res = await makeRequest({
        hostname: '127.0.0.1',
        port,
        path: '/api/v1/telemetry',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      }, {
        type: 'heartbeat',
        sessionId: 'test_sess_01',
        appId: 'academy-library'
      });

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.data.error, 'UNAUTHORIZED_SPOKE');
    });

    await test('Rejects telemetry with invalid token credentials (HTTP 401)', async () => {
      const res = await makeRequest({
        hostname: '127.0.0.1',
        port,
        path: '/api/v1/telemetry',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-spoke-token': 'invalid_secret_token_123',
          'x-spoke-app-id': 'academy-library'
        }
      }, {
        type: 'heartbeat',
        sessionId: 'test_sess_01',
        appId: 'academy-library'
      });

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.data.error, 'INVALID_SPOKE_TOKEN');
    });

    await test('Rejects unregistered tenant appId (HTTP 403)', async () => {
      const res = await makeRequest({
        hostname: '127.0.0.1',
        port,
        path: '/api/v1/telemetry',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-spoke-token': 'spk_live_acadlib_99f2b84',
          'x-spoke-app-id': 'unregistered-rogue-spoke'
        }
      }, {
        type: 'session_start',
        sessionId: 'test_sess_rogue',
        appId: 'unregistered-rogue-spoke'
      });

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.data.error, 'TENANT_NOT_REGISTERED');
    });

    // ---------------------------------------------------------------
    // 2. OWASP PII and Secret Sanitization
    // ---------------------------------------------------------------
    console.log('\n--- 2. OWASP CREDENTIAL & PII REDACTION ---');

    await test('Recursively sanitizes passwords, auth tokens, bearer headers, and credit cards', () => {
      const payload = {
        user: 'sarah.connor@academy.edu',
        password: 'PlainTextPassword123!',
        authToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        creditCard: '4532 1234 5678 9010',
        note: 'Customer card on file: 4532 1234 5678 9010',
        metadata: {
          secret: 'super_secret_key',
          apiKey: 'AIzaSyC3...',
          nested: {
            cvv: '123',
            safeField: 'Allowed telemetry value'
          }
        }
      };

      const clean = sanitizeObject(payload);
      assert.strictEqual(clean.password, '[REDACTED_BY_SPOKEOPS_OWASP]');
      assert.strictEqual(clean.authToken, '[REDACTED_BY_SPOKEOPS_OWASP]');
      assert.ok(clean.creditCard === '[REDACTED_BY_SPOKEOPS_OWASP]' || clean.creditCard === '****-****-****-****');
      assert.strictEqual(clean.note, 'Customer card on file: ****-****-****-****');
      assert.strictEqual(clean.metadata.secret, '[REDACTED_BY_SPOKEOPS_OWASP]');
      assert.strictEqual(clean.metadata.apiKey, '[REDACTED_BY_SPOKEOPS_OWASP]');
      assert.strictEqual(clean.metadata.nested.cvv, '[REDACTED_BY_SPOKEOPS_OWASP]');
      assert.strictEqual(clean.metadata.nested.safeField, 'Allowed telemetry value');
    });

    // ---------------------------------------------------------------
    // 3. Telemetry Ingestion API (Session Start, Heartbeat, Audit Event)
    // ---------------------------------------------------------------
    console.log('\n--- 3. TELEMETRY INGESTION PIPELINE ---');

    const validToken = 'spk_live_acadlib_99f2b84';
    const testSessionId = `test_sess_${Date.now()}`;

    await test('Ingests session_start payload successfully', async () => {
      const res = await makeRequest({
        hostname: '127.0.0.1',
        port,
        path: '/api/v1/telemetry',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-spoke-token': validToken,
          'x-spoke-app-id': 'academy-library'
        }
      }, {
        type: 'session_start',
        sessionId: testSessionId,
        appId: 'academy-library',
        userId: 'usr_test_verification',
        userEmail: 'auditor@academy.edu',
        userRoles: ['instructor', 'lead_reviewer'],
        clientMetadata: {
          browser: 'Firefox',
          os: 'Linux',
          ipAddress: '10.0.4.99',
          viewport: '1920x1080'
        }
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.acknowledged, true);
      assert.strictEqual(res.data.sessionId, testSessionId);

      const store = getSessionsStore();
      const saved = store.get(testSessionId);
      assert.ok(saved);
      assert.strictEqual(saved.status, 'active');
      assert.strictEqual(saved.userEmail, 'auditor@academy.edu');
    });

    await test('Ingests audit_event with OWASP redaction of injected secret payload', async () => {
      const res = await makeRequest({
        hostname: '127.0.0.1',
        port,
        path: '/api/v1/telemetry',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-spoke-token': validToken,
          'x-spoke-app-id': 'academy-library'
        }
      }, {
        type: 'audit_event',
        sessionId: testSessionId,
        appId: 'academy-library',
        userId: 'usr_test_verification',
        userEmail: 'auditor@academy.edu',
        userRoles: ['instructor'],
        auditEvent: {
          eventId: 'evt_test_audit_99',
          action: 'resource_update',
          resourceType: 'curriculum_unit',
          resourceId: 'unit_physics_505',
          status: 'success',
          metadata: {
            title: 'Syllabus revised',
            password: 'secret_leak_attempt',
            apiKey: 'AIza_leak'
          }
        }
      });

      assert.strictEqual(res.status, 200);

      const events = getEventsStore();
      const event = events.find((e) => e.eventId === 'evt_test_audit_99');
      assert.ok(event);
      assert.strictEqual(event.metadata.title, 'Syllabus revised');
      assert.strictEqual(event.metadata.password, '[REDACTED_BY_SPOKEOPS_OWASP]');
      assert.strictEqual(event.metadata.apiKey, '[REDACTED_BY_SPOKEOPS_OWASP]');
    });

    // ---------------------------------------------------------------
    // 4. Session Reaper Service (Stale Heartbeat Sweeper)
    // ---------------------------------------------------------------
    console.log('\n--- 4. BACKGROUND SESSION REAPER ---');

    await test('Reaps active/idle sessions with lastHeartbeat older than 6 minutes', () => {
      const store = getSessionsStore();
      const staleSessionId = 'sess_stale_test_reap';

      // Insert an active session with heartbeat 7 minutes ago
      store.set(staleSessionId, {
        sessionId: staleSessionId,
        appId: 'academy-timeliner',
        userId: 'usr_stale_worker',
        userEmail: 'worker@academy.edu',
        userRoles: ['scheduler'],
        startedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        lastHeartbeat: new Date(Date.now() - 7 * 60 * 1000).toISOString(), // 7 min ago (> 6 min)
        durationSeconds: 1800,
        status: 'active',
        clientMetadata: {
          userAgent: 'Chrome',
          browser: 'Google Chrome',
          os: 'macOS',
          ipAddress: '192.168.1.50',
          viewport: '1920x1080'
        }
      });

      const reapResult = reapStaleSessions();
      assert.ok(reapResult.timedOutSessionIds.includes(staleSessionId));

      const updatedSession = store.get(staleSessionId);
      assert.strictEqual(updatedSession?.status, 'timed_out');
    });

    // ---------------------------------------------------------------
    // 5. Query Endpoints & Ops Admin Disconnect
    // ---------------------------------------------------------------
    console.log('\n--- 5. API QUERY & ADMINISTRATIVE EVICTION ---');

    await test('GET /api/v1/sessions filters by tenant appId', async () => {
      const res = await makeRequest({
        hostname: '127.0.0.1',
        port,
        path: '/api/v1/sessions?appId=academy-library',
        method: 'GET'
      });

      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.data.sessions));
      res.data.sessions.forEach((s: any) => {
        assert.strictEqual(s.appId, 'academy-library');
      });
    });

    await test('POST /api/v1/sessions/disconnect evicts session and emits audit log', async () => {
      const res = await makeRequest({
        hostname: '127.0.0.1',
        port,
        path: '/api/v1/sessions/disconnect',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        sessionId: testSessionId,
        reason: 'Eviction test by Ops Admin'
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(res.data.status, 'closed');

      const store = getSessionsStore();
      const s = store.get(testSessionId);
      assert.strictEqual(s?.status, 'closed');

      // Verify that eviction emitted an audit event
      const events = getEventsStore();
      const evictionEvent = events.find(
        (e) => e.action === 'role_revoke' && e.resourceId === testSessionId
      );
      assert.ok(evictionEvent);
      assert.strictEqual(evictionEvent.status, 'warning');
    });

    // ---------------------------------------------------------------
    // 6. Hub-Spoke Agent Platform Telemetry & Audit Verification
    // ---------------------------------------------------------------
    console.log('\n--- 6. HUB-SPOKE AGENT PLATFORM SPOKEOPS HOOKS ---');

    const hubSpokeToken = 'spk_live_hubspoke_b82f109';
    const hubSessionId = `hub_sess_${Date.now()}`;

    await test('Ingests Hub-Spoke session_heartbeat with active status', async () => {
      const res = await makeRequest({
        hostname: '127.0.0.1',
        port,
        path: '/api/v1/telemetry',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-spoke-token': hubSpokeToken,
          'x-spoke-app-id': 'hub-spoke-agent-platform'
        }
      }, {
        type: 'session_heartbeat',
        appId: 'hub-spoke-agent-platform',
        sessionId: hubSessionId,
        userId: 'usr_hub_op_01',
        userEmail: 'operator@hub-spoke.net',
        userRoles: ['platform_operator'],
        status: 'active',
        clientMetadata: {
          userAgent: 'Chrome/123.0',
          viewport: '1920x1080',
          path: '/launcher'
        }
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.acknowledged, true);

      const store = getSessionsStore();
      const session = store.get(hubSessionId);
      assert.ok(session);
      assert.strictEqual(session.appId, 'hub-spoke-agent-platform');
      assert.strictEqual(session.status, 'active');
      assert.strictEqual(session.userEmail, 'operator@hub-spoke.net');
    });

    await test('Ingests agent_task_started and agent_task_executed audit events', async () => {
      // 1. Task started
      const resStart = await makeRequest({
        hostname: '127.0.0.1',
        port,
        path: '/api/v1/telemetry',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-spoke-token': hubSpokeToken,
          'x-spoke-app-id': 'hub-spoke-agent-platform'
        }
      }, {
        type: 'audit_event',
        appId: 'hub-spoke-agent-platform',
        sessionId: hubSessionId,
        userId: 'usr_hub_op_01',
        userEmail: 'operator@hub-spoke.net',
        roleAtExecution: 'platform_operator',
        action: 'agent_task_started',
        resourceType: 'agent_workflow',
        resourceId: hubSessionId,
        status: 'success',
        metadata: {
          promptLength: 120,
          targetAgent: 'spoke-housekeeper',
          action: 'clean_repo_noise'
        }
      });
      assert.strictEqual(resStart.status, 200);

      // 2. Tool executed
      const resExec = await makeRequest({
        hostname: '127.0.0.1',
        port,
        path: '/api/v1/telemetry',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-spoke-token': hubSpokeToken,
          'x-spoke-app-id': 'hub-spoke-agent-platform'
        }
      }, {
        type: 'audit_event',
        appId: 'hub-spoke-agent-platform',
        sessionId: hubSessionId,
        userId: 'usr_hub_op_01',
        userEmail: 'operator@hub-spoke.net',
        roleAtExecution: 'platform_operator',
        action: 'agent_task_executed',
        resourceType: 'tool_dispatch',
        resourceId: 'spoke-housekeeper-worker',
        status: 'success',
        metadata: {
          executionDurationMs: 340,
          tool: 'spoke-housekeeper-worker'
        }
      });
      assert.strictEqual(resExec.status, 200);

      // Query events API to verify persistence
      const resQuery = await makeRequest({
        hostname: '127.0.0.1',
        port,
        path: '/api/v1/events?appId=hub-spoke-agent-platform',
        method: 'GET'
      });
      assert.strictEqual(resQuery.status, 200);
      const hubEvents = resQuery.data.events.filter((e: any) => e.sessionId === hubSessionId);
      assert.ok(hubEvents.length >= 2);
      assert.ok(hubEvents.some((e: any) => e.action === 'agent_task_started'));
      assert.ok(hubEvents.some((e: any) => e.action === 'agent_task_executed'));
    });

    await test('Ingests permission_denied audit event with user RBAC claims', async () => {
      const resDenied = await makeRequest({
        hostname: '127.0.0.1',
        port,
        path: '/api/v1/telemetry',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-spoke-token': hubSpokeToken,
          'x-spoke-app-id': 'hub-spoke-agent-platform'
        }
      }, {
        type: 'audit_event',
        appId: 'hub-spoke-agent-platform',
        sessionId: hubSessionId,
        userId: 'usr_hub_op_01',
        userEmail: 'operator@hub-spoke.net',
        roleAtExecution: 'viewer',
        action: 'permission_denied',
        resourceType: 'control_plane_route',
        resourceId: '/launcher/dispatch',
        status: 'denied',
        metadata: {
          requiredRole: 'operator',
          currentRoles: ['viewer']
        }
      });
      assert.strictEqual(resDenied.status, 200);

      const events = getEventsStore();
      const deniedEvent = events.find(
        (e) => e.sessionId === hubSessionId && e.action === 'permission_denied'
      );
      assert.ok(deniedEvent);
      assert.strictEqual(deniedEvent.status, 'denied');
      assert.strictEqual(deniedEvent.metadata.requiredRole, 'operator');
    });

    // ---------------------------------------------------------------
    // 7. Telemetry Range Controls (30d, ALL) & Cursor Pagination
    // ---------------------------------------------------------------
    console.log('\n--- 7. TELEMETRY RANGE CONTROLS (30d, ALL) & CURSOR PAGINATION ---');

    const rangeTenant = 'academy-timeliner';
    const nowTime = Date.now();
    const eventRecentId = `evt_range_rec_${nowTime}`;
    const event15dId = `evt_range_15d_${nowTime}`;
    const event45dId = `evt_range_45d_${nowTime}`;

    // Seed events into eventsStore for range verification
    const eventsStore = getEventsStore();
    eventsStore.push({
      eventId: eventRecentId,
      appId: rangeTenant,
      sessionId: 'sess_range_01',
      userId: 'usr_range_tester',
      userEmail: 'tester@academy.edu',
      roleAtExecution: 'scheduler',
      action: 'resource_update',
      resourceType: 'schedule',
      resourceId: 'sch_recent',
      status: 'success',
      metadata: { rangeTest: true },
      timestamp: new Date(nowTime - 10 * 60 * 1000).toISOString() // 10 min ago
    });

    eventsStore.push({
      eventId: event15dId,
      appId: rangeTenant,
      sessionId: 'sess_range_02',
      userId: 'usr_range_tester',
      userEmail: 'tester@academy.edu',
      roleAtExecution: 'scheduler',
      action: 'resource_update',
      resourceType: 'schedule',
      resourceId: 'sch_15d',
      status: 'warning',
      metadata: { rangeTest: true },
      timestamp: new Date(nowTime - 15 * 24 * 60 * 60 * 1000).toISOString() // 15 days ago
    });

    eventsStore.push({
      eventId: event45dId,
      appId: rangeTenant,
      sessionId: 'sess_range_03',
      userId: 'usr_range_tester',
      userEmail: 'tester@academy.edu',
      roleAtExecution: 'scheduler',
      action: 'resource_delete',
      resourceType: 'schedule',
      resourceId: 'sch_45d',
      status: 'denied',
      metadata: { rangeTest: true },
      timestamp: new Date(nowTime - 45 * 24 * 60 * 60 * 1000).toISOString() // 45 days ago
    });

    await test('Filters events strictly within 7d range', async () => {
      const res = await makeRequest({
        hostname: '127.0.0.1',
        port,
        path: `/api/v1/events?appId=${rangeTenant}&range=7d`,
        method: 'GET'
      });

      assert.strictEqual(res.status, 200);
      const ids = res.data.events.map((e: any) => e.eventId);
      assert.strictEqual(ids.includes(eventRecentId), true);
      assert.strictEqual(ids.includes(event15dId), false, '15d event should not be in 7d range');
      assert.strictEqual(ids.includes(event45dId), false, '45d event should not be in 7d range');
    });

    await test('Filters events with 30d lower bound relative to Date.now()', async () => {
      const res = await makeRequest({
        hostname: '127.0.0.1',
        port,
        path: `/api/v1/events?appId=${rangeTenant}&range=30d`,
        method: 'GET'
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.range, '30d');
      const ids = res.data.events.map((e: any) => e.eventId);
      assert.strictEqual(ids.includes(eventRecentId), true, 'Recent event must be in 30d range');
      assert.strictEqual(ids.includes(event15dId), true, '15d event must be in 30d range');
      assert.strictEqual(ids.includes(event45dId), false, '45d event must NOT be in 30d range');
    });

    await test('Unbounded ALL range removes lower timestamp constraint and strictly applies orderBy timestamp desc', async () => {
      const res = await makeRequest({
        hostname: '127.0.0.1',
        port,
        path: `/api/v1/events?appId=${rangeTenant}&range=ALL`,
        method: 'GET'
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.range, 'ALL');
      const ids = res.data.events.map((e: any) => e.eventId);
      assert.strictEqual(ids.includes(eventRecentId), true);
      assert.strictEqual(ids.includes(event15dId), true);
      assert.strictEqual(ids.includes(event45dId), true, '45d event must be included in ALL');

      // Verify descending order
      for (let i = 0; i < res.data.events.length - 1; i++) {
        const cur = new Date(res.data.events[i].timestamp).getTime();
        const next = new Date(res.data.events[i + 1].timestamp).getTime();
        assert.ok(cur >= next, 'Events must be ordered by timestamp desc');
      }
    });

    await test('Emits valid cursor-paginated responses with batch limit, nextCursor, and hasMore', async () => {
      // Page 1: limit=1
      const resPage1 = await makeRequest({
        hostname: '127.0.0.1',
        port,
        path: `/api/v1/events?appId=${rangeTenant}&range=ALL&limit=1`,
        method: 'GET'
      });

      assert.strictEqual(resPage1.status, 200);
      assert.strictEqual(resPage1.data.events.length, 1);
      assert.strictEqual(resPage1.data.hasMore, true);
      assert.ok(resPage1.data.nextCursor, 'nextCursor must be populated when hasMore is true');

      const firstItem = resPage1.data.events[0];
      const cursor1 = resPage1.data.nextCursor;

      // Page 2: with cursor
      const resPage2 = await makeRequest({
        hostname: '127.0.0.1',
        port,
        path: `/api/v1/events?appId=${rangeTenant}&range=ALL&limit=1&cursor=${encodeURIComponent(cursor1)}`,
        method: 'GET'
      });

      assert.strictEqual(resPage2.status, 200);
      assert.strictEqual(resPage2.data.events.length, 1);
      const secondItem = resPage2.data.events[0];
      assert.notStrictEqual(firstItem.eventId, secondItem.eventId, 'Page 2 item must differ from Page 1 item');
    });

    await test('Accurately identifies spokes with zero transactions older than 7 days', async () => {
      // Tenant 'academy-insight' has no events seeded older than 7 days
      const res = await makeRequest({
        hostname: '127.0.0.1',
        port,
        path: '/api/v1/events?appId=academy-insight&range=30d',
        method: 'GET'
      });

      assert.strictEqual(res.status, 200);
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const olderRecords = res.data.events.filter(
        (e: any) => new Date(e.timestamp).getTime() < sevenDaysAgo
      );
      assert.strictEqual(olderRecords.length, 0, 'Spoke should have zero transactions older than 7 days');
    });

    console.log('\n======================================================');
    console.log(`🎉 ALL ${passedTests}/${totalTests} TESTS PASSED CLEANLY!`);
    console.log('======================================================\n');
  } finally {
    server.close();
  }
}

runVerification().catch((err) => {
  console.error('Platform verification failed:', err);
  process.exit(1);
});
