import assert from "assert";
import { SpokeOpsTelemetry, AuditEventPayload } from "../src/telemetry/spokeOpsClient.ts";

async function runClientTests() {
  console.log("\n=======================================================");
  console.log("🧪 SPOKEOPS CLIENT TELEMETRY SDK UNIT TEST (AES v3)");
  console.log("=======================================================\n");

  let passed = 0;
  let total = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    total++;
    try {
      fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
    }
  }

  // Mock global environment
  const dispatchedPayloads: any[] = [];
  const dispatchedBeacons: any[] = [];

  (globalThis as any).fetch = (url: string, options: any) => {
    dispatchedPayloads.push({
      url,
      headers: options.headers,
      body: JSON.parse(options.body),
      keepalive: options.keepalive
    });
    return Promise.resolve({ ok: true });
  };

  Object.defineProperty(globalThis, "navigator", {
    value: {
      userAgent: "Mozilla/5.0 Unit-Test/1.0",
      sendBeacon: (url: string, data: any) => {
        dispatchedBeacons.push({ url, data });
        return true;
      }
    },
    configurable: true,
    writable: true
  });

  (globalThis as any).window = {
    innerWidth: 1920,
    innerHeight: 1080,
    location: { pathname: "/launcher" },
    addEventListener: () => {}
  };

  (globalThis as any).document = {
    visibilityState: "visible",
    addEventListener: () => {}
  };

  // Instantiate client
  const client = new SpokeOpsTelemetry();

  test("Client initializes with SpokeUser claims and generates session ID", () => {
    client.init({
      uid: "usr_unit_01",
      email: "operator@hub-spoke.net",
      roles: ["platform_operator"]
    });

    const sessionId = client.getSessionId();
    assert.ok(sessionId, "Session ID should be defined");
    assert.ok(sessionId.startsWith("sess_"), "Session ID format should match sess_*");
    assert.strictEqual(client.getCurrentUser()?.email, "operator@hub-spoke.net");
    assert.strictEqual(client.getAppId(), "hub-spoke-agent-platform");
  });

  test("Initializes by sending active session_heartbeat ping", () => {
    assert.ok(dispatchedPayloads.length >= 1, "At least one heartbeat dispatched on init");
    const ping = dispatchedPayloads[0];
    assert.strictEqual(ping.body.type, "session_heartbeat");
    assert.strictEqual(ping.body.status, "active");
    assert.strictEqual(ping.body.appId, "hub-spoke-agent-platform");
    assert.strictEqual(ping.headers["x-spoke-token"], "spk_live_hubspoke_b82f109");
    assert.strictEqual(ping.headers["x-spoke-app-id"], "hub-spoke-agent-platform");
  });

  test("logAudit scrubs sensitive credentials from metadata (OWASP Standard)", () => {
    dispatchedPayloads.length = 0;

    const event: AuditEventPayload = {
      action: "agent_task_started",
      resourceType: "agent_workflow",
      resourceId: "wf_test_123",
      status: "success",
      metadata: {
        taskName: "cleanup_repo",
        apiKey: "AIzaSySecretApiKey123",
        userPassword: "PlainPassword123!",
        bearerToken: "Bearer secret_jwt_token",
        credentials: "sensitive_cred_block",
        safeParam: "all_good"
      }
    };

    client.logAudit(event);

    assert.strictEqual(dispatchedPayloads.length, 1);
    const auditPayload = dispatchedPayloads[0].body;
    assert.strictEqual(auditPayload.type, "audit_event");
    assert.strictEqual(auditPayload.action, "agent_task_started");
    assert.strictEqual(auditPayload.resourceType, "agent_workflow");
    assert.strictEqual(auditPayload.resourceId, "wf_test_123");
    assert.strictEqual(auditPayload.status, "success");

    // Check credential redaction
    assert.strictEqual(auditPayload.metadata.apiKey, "[REDACTED]");
    assert.strictEqual(auditPayload.metadata.userPassword, "[REDACTED]");
    assert.strictEqual(auditPayload.metadata.bearerToken, "[REDACTED]");
    assert.strictEqual(auditPayload.metadata.credentials, "[REDACTED]");
    assert.strictEqual(auditPayload.metadata.safeParam, "all_good");
    assert.strictEqual(auditPayload.metadata.taskName, "cleanup_repo");
  });

  test("closeSession dispatches closed session payload via sendBeacon", () => {
    dispatchedBeacons.length = 0;
    client.closeSession();

    assert.strictEqual(dispatchedBeacons.length, 1);
    const beacon = dispatchedBeacons[0];
    assert.ok(beacon.url.includes("spokeToken=spk_live_hubspoke_b82f109"));
    assert.ok(beacon.url.includes("appId=hub-spoke-agent-platform"));
  });

  console.log("\n=======================================================");
  console.log(`🎉 ALL ${passed}/${total} UNIT TESTS PASSED CLEANLY!`);
  console.log("=======================================================\n");

  if (passed !== total) {
    process.exit(1);
  }
}

runClientTests();
