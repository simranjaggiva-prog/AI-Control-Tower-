import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function text(value, field) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} must be a non-empty string`);
  return value.trim();
}

function httpsUrl(value, field, allowedHosts) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) {
    throw new Error(`${field} must be an HTTPS URL without credentials or a nonstandard port`);
  }
  if (!allowedHosts(url.hostname)) throw new Error(`${field} has an unsupported host`);
  return url;
}

export function validateInventory(input) {
  if (!input || !Array.isArray(input.solutions)) throw new Error("Inventory must contain a solutions array");
  if (Object.keys(input).some((key) => key !== "solutions")) throw new Error("Only solutions is allowed at the inventory root");
  const ids = new Set();
  return input.solutions.map((entry) => {
    if (!entry || typeof entry !== "object") throw new Error("Each solution must be an object");
    const allowed = new Set(["id", "name", "owner", "environment", "foundryProjectEndpoint", "apiType", "agentId", "agentName", "agentVersion"]);
    if (Object.keys(entry).some((key) => !allowed.has(key))) throw new Error("Inventory permits only approved metadata fields; never add secrets or prompts");
    const id = text(entry.id, "id");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || ids.has(id)) {
      throw new Error(`Invalid or duplicate solution id: ${id}`);
    }
    ids.add(id);
    if (entry.environment !== "nonprod") throw new Error(`${id}: only environment nonprod is supported`);
    if (!["unknown", "classic", "response"].includes(entry.apiType)) {
      throw new Error(`${id}: apiType must be unknown, classic or response`);
    }
    const endpoint = httpsUrl(text(entry.foundryProjectEndpoint, "foundryProjectEndpoint"),
      "foundryProjectEndpoint", (host) => /^[a-z0-9-]+\.services\.ai\.azure\.com$/.test(host));
    if (!/^\/api\/projects\/[^/]+\/?$/.test(endpoint.pathname) || endpoint.search || endpoint.hash) {
      throw new Error(`${id}: use the Foundry project endpoint ending in /api/projects/<project>`);
    }
    const solution = {
      id, name: text(entry.name, "name"), owner: text(entry.owner, "owner"),
      environment: "nonprod", foundryProjectEndpoint: endpoint.href.replace(/\/$/, ""),
      apiType: entry.apiType
    };
    for (const field of ["agentId", "agentName", "agentVersion"]) {
      if (entry[field] !== undefined) solution[field] = text(entry[field], field);
    }
    if (solution.apiType === "classic" && !solution.agentId) throw new Error(`${id}: classic requires agentId`);
    if (solution.apiType === "response" && (!solution.agentName || !solution.agentVersion)) {
      throw new Error(`${id}: response requires agentName and agentVersion`);
    }
    return solution;
  });
}

export function loadInventory(path) {
  return validateInventory(JSON.parse(readFileSync(path, "utf8")));
}

export function loadConfig(env = process.env) {
  if (env.ENABLE_CONTROLS !== undefined && env.ENABLE_CONTROLS !== "false") {
    throw new Error("ENABLE_CONTROLS must be false. No runtime enforcement adapter is included.");
  }
  if (env.REQUIRE_AUTH !== undefined && !["true", "false"].includes(env.REQUIRE_AUTH)) {
    throw new Error("REQUIRE_AUTH must be true or false");
  }
  const requireAuth = env.REQUIRE_AUTH !== "false";
  const development = env.NODE_ENV === "development";
  const host = env.HOST || (development ? "127.0.0.1" : "0.0.0.0");
  if (!requireAuth && (!development || !["127.0.0.1", "::1"].includes(host))) {
    throw new Error("Unauthenticated preview requires NODE_ENV=development and a loopback HOST");
  }
  const azure = {
    appConfig: env.APP_CONFIG_ENDPOINT || "",
    cosmos: env.COSMOS_ENDPOINT || "",
    blob: env.STORAGE_BLOB_ENDPOINT || ""
  };
  const cloud = Object.values(azure).some(Boolean);
  if ((!development || cloud) && !Object.values(azure).every(Boolean)) {
    throw new Error("APP_CONFIG_ENDPOINT, COSMOS_ENDPOINT and STORAGE_BLOB_ENDPOINT are all required in Azure mode");
  }
  if (cloud) {
    httpsUrl(azure.appConfig, "APP_CONFIG_ENDPOINT", (h) => h.endsWith(".azconfig.io"));
    httpsUrl(azure.cosmos, "COSMOS_ENDPOINT", (h) => h.endsWith(".documents.azure.com"));
    httpsUrl(azure.blob, "STORAGE_BLOB_ENDPOINT", (h) => h.endsWith(".blob.core.windows.net"));
  }
  const reportUrl = env.POWERBI_REPORT_URL || "";
  const openUrl = env.POWERBI_OPEN_URL || "";
  for (const [name, value] of [["POWERBI_REPORT_URL", reportUrl], ["POWERBI_OPEN_URL", openUrl]]) {
    if (value) {
      const url = httpsUrl(value, name, (h) => h === "app.powerbi.com");
      if (name === "POWERBI_REPORT_URL" && url.pathname !== "/reportEmbed") {
        throw new Error("POWERBI_REPORT_URL must be a secure /reportEmbed URL, not Publish to web");
      }
      if (url.pathname.startsWith("/view")) throw new Error("Public Power BI Publish to web URLs are not supported");
    }
  }
  const port = Number(env.PORT || 3000);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error("PORT must be an integer from 0 to 65535");
  return {
    requireAuth, host, port, cloud, azure,
    inventoryPath: resolve(env.SOLUTION_CONFIG_FILE || "./config/solutions.json"),
    organizationName: env.ORGANIZATION_NAME || "Customer",
    applicationName: env.APPLICATION_NAME || "AI Control Tower",
    reportUrl, openUrl
  };
}
