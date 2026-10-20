import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { loadConfig, loadInventory, validateInventory } from "../src/config.js";
import { createApp } from "../src/app.js";
import { createDependencyCheck } from "../src/dependencies.js";

const development = { NODE_ENV: "development", REQUIRE_AUTH: "false", HOST: "127.0.0.1" };
const metadata = {
  id: "test-only", name: "Test fixture", owner: "Test owner", environment: "nonprod",
  foundryProjectEndpoint: "https://test-only.services.ai.azure.com/api/projects/test",
  apiType: "unknown"
};
const logger = { error() {}, warn() {} };
function principal(role) {
  return {
    "x-ms-client-principal-id": "test-identity",
    "x-ms-client-principal": Buffer.from(JSON.stringify({ claims: [{ typ: "roles", val: role }] })).toString("base64")
  };
}

async function withServer(options, callback) {
  const config = loadConfig({ ...development, ...options.env });
  const temporaryDirectory = options.inventoryPath ? null : mkdtempSync(join(tmpdir(), "ct-empty-test-"));
  config.inventoryPath = options.inventoryPath || join(temporaryDirectory, "solutions.json");
  if (temporaryDirectory) writeFileSync(config.inventoryPath, JSON.stringify({ solutions: [] }));
  const app = createApp(config, {
    logger, checkDependencies: options.checkDependencies || createDependencyCheck(config),
    readinessTimeoutMs: options.readinessTimeoutMs
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  try {
    await callback((path, init) => fetch(`http://127.0.0.1:${address.port}${path}`, init));
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (temporaryDirectory) {
      rmSync(config.inventoryPath);
      rmdirSync(temporaryDirectory);
    }
  }
}

test("customer inventory validates and empty inventories are supported", () => {
  assert.ok(Array.isArray(loadInventory("./config/solutions.json")));
  assert.deepEqual(validateInventory({ solutions: [] }), []);
});
test("validates metadata without inventing state", () => {
  assert.deepEqual(validateInventory({ solutions: [metadata] }), [metadata]);
});
test("rejects invalid, duplicate, production and secret-bearing inventory", () => {
  for (const mutation of [
    { id: "bad id" }, { owner: "" }, { environment: "prod" }, { apiType: "guessed" },
    { apiType: "classic" }, { apiType: "response", agentName: "agent" },
    { foundryProjectEndpoint: "https://attacker.example/api/projects/test" },
    { foundryProjectEndpoint: "http://test-only.services.ai.azure.com/api/projects/test" },
    { foundryProjectEndpoint: `${metadata.foundryProjectEndpoint}?key=secret` },
    { secret: "never-store-this" }
  ]) assert.throws(() => validateInventory({ solutions: [{ ...metadata, ...mutation }] }));
  assert.throws(() => validateInventory({ solutions: [metadata, metadata] }));
  assert.throws(() => validateInventory({ solutions: [], token: "forbidden" }));
  assert.throws(() => validateInventory({}));
});
test("known API inventory requires confirmed identifiers", () => {
  assert.equal(validateInventory({ solutions: [{ ...metadata, apiType: "classic", agentId: "asst_test" }] })[0].agentId, "asst_test");
  assert.equal(validateInventory({ solutions: [{ ...metadata, apiType: "response", agentName: "test", agentVersion: "1" }] })[0].agentVersion, "1");
});
test("controls cannot be enabled and invalid boolean is rejected", () => {
  for (const value of ["true", "TRUE", "1", ""]) assert.throws(() => loadConfig({ ...development, ENABLE_CONTROLS: value }));
  assert.throws(() => loadConfig({ ...development, REQUIRE_AUTH: "yes" }));
});
test("unauthenticated preview is loopback and development only", () => {
  assert.throws(() => loadConfig({ ...development, HOST: "0.0.0.0" }));
  assert.throws(() => loadConfig({ ...development, NODE_ENV: "production" }));
  assert.throws(() => loadConfig({ ...development, NODE_ENV: "test" }));
  assert.throws(() => loadConfig({ ...development, PORT: "invalid" }));
});
test("production requires all endpoints and authentication", () => {
  assert.throws(() => loadConfig({ NODE_ENV: "production", REQUIRE_AUTH: "true" }));
  const env = {
    NODE_ENV: "production", REQUIRE_AUTH: "true",
    APP_CONFIG_ENDPOINT: "https://test.azconfig.io",
    COSMOS_ENDPOINT: "https://test.documents.azure.com",
    STORAGE_BLOB_ENDPOINT: "https://test.blob.core.windows.net"
  };
  assert.equal(loadConfig(env).cloud, true);
  assert.throws(() => loadConfig({ ...env, REQUIRE_AUTH: "false" }));
});
test("Power BI only permits secure trusted report URLs", () => {
  assert.equal(loadConfig({ ...development, POWERBI_REPORT_URL: "https://app.powerbi.com/reportEmbed?reportId=test" }).reportUrl.includes("reportEmbed"), true);
  for (const value of ["https://app.powerbi.com/view?r=public", "http://app.powerbi.com/reportEmbed", "https://app.powerbi.com.evil.example/reportEmbed", "https://user:pass@app.powerbi.com/reportEmbed"]) {
    assert.throws(() => loadConfig({ ...development, POWERBI_REPORT_URL: value }));
  }
  assert.throws(() => loadConfig({ ...development, POWERBI_OPEN_URL: "https://app.powerbi.com/view?r=public" }));
});
test("empty control room returns exact empty telemetry and command shapes", async () => {
  await withServer({}, async (request) => {
    const state = await (await request("/api/control-room")).json();
    assert.deepEqual(state.solutions, []);
    assert.deepEqual(state.telemetry, []);
    assert.deepEqual(state.commands, []);
    assert.equal(state.identity.canOperate, false);
    const config = await (await request("/api/config")).json();
    assert.equal(config.enableControls, false);
    assert.equal(config.mode, "foundation");
    const ready = await (await request("/readyz")).json();
    assert.equal(ready.mode, "local-preview");
    assert.equal(ready.dependencies, "not-configured");
    assert.equal(ready.enforcementReady, false);
  });
});
test("all mutation methods are forbidden even for Operator or anonymous callers", async () => {
  await withServer({ env: { REQUIRE_AUTH: "true" } }, async (request) => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      for (const headers of [{}, principal("AIControlRoom.Operator")]) {
        const response = await request("/api/solutions/test/commands", { method, headers });
        assert.equal(response.status, 403);
        assert.equal((await response.json()).code, "ENFORCEMENT_NOT_AVAILABLE");
      }
    }
  });
});
test("authenticated API requires valid EasyAuth principal and approved role", async () => {
  await withServer({ env: { REQUIRE_AUTH: "true" } }, async (request) => {
    assert.equal((await request("/api/solutions")).status, 401);
    assert.equal((await request("/api/solutions", { headers: { ...principal("AIControlRoom.Viewer"), "x-ms-client-principal": "invalid" } })).status, 401);
    assert.equal((await request("/api/solutions", { headers: principal("unassigned") })).status, 403);
    for (const role of ["AIControlRoom.Viewer", "AIControlRoom.Operator"]) {
      assert.equal((await request("/api/solutions", { headers: principal(role) })).status, 200);
    }
  });
});
test("readiness dependency failure is explicit and never enforcement-ready", async () => {
  await withServer({ checkDependencies: async () => { throw new Error("Test dependency unavailable"); } }, async (request) => {
    assert.equal((await request("/healthz")).status, 200);
    const response = await request("/readyz");
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { status: "not_ready", enforcementReady: false });
  });
});
test("readiness times out instead of claiming success on a stalled dependency", async () => {
  await withServer({ checkDependencies: () => new Promise(() => {}), readinessTimeoutMs: 20 }, async (request) => {
    const response = await request("/readyz");
    assert.equal(response.status, 503);
    assert.equal((await response.json()).enforcementReady, false);
  });
});
test("registered solution is unknown, not a live discovery; invalid reload fails visibly", async () => {
  const directory = mkdtempSync(join(tmpdir(), "ct-foundation-test-"));
  const inventoryPath = join(directory, "solutions.json");
  try {
    writeFileSync(inventoryPath, JSON.stringify({ solutions: [metadata] }));
    await withServer({ inventoryPath }, async (request) => {
      const body = await (await request("/api/solutions/test-only")).json();
      assert.equal(body.solution.observedStatus, "unknown");
      assert.equal(body.solution.enforcementStatus, "not-integrated");
      assert.equal(body.telemetry, null);
      assert.deepEqual(body.commands, []);
      assert.equal((await request("/api/solutions/not-registered")).status, 404);
      writeFileSync(inventoryPath, "{invalid");
      assert.equal((await request("/api/solutions")).status, 500);
      assert.equal((await request("/readyz")).status, 503);
    });
  } finally { rmSync(inventoryPath, { force: true }); rmdirSync(directory); }
});
test("four-screen UI defaults to foundation mode and keeps security headers", async () => {
  await withServer({}, async (request) => {
    const response = await request("/");
    const html = await response.text();
    for (const page of ["dashboard", "solutions", "agent", "controls"]) assert.match(html, new RegExp(`href="#${page}"`));
    assert.match(html, /id="preview" type="checkbox">/);
    assert.doesNotMatch(html, /id="preview"[^>]*checked/);
    assert.match(html, /type="module" src="\/app.js"/);
    assert.match(response.headers.get("content-security-policy"), /frame-ancestors 'none'/);
    assert.doesNotMatch(html, /onclick=/);
    for (const path of ["/app.js", "/showcase.js", "/styles.css", "/images/mufg-logo.png"]) {
      assert.equal((await request(path)).status, 200, path);
    }
    assert.deepEqual((await (await request("/api/control-room")).json()).telemetry, []);
  });
});
