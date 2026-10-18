import express from "express";
import { fileURLToPath } from "node:url";
import { loadInventory } from "./config.js";

const roles = new Set(["AIControlRoom.Viewer", "AIControlRoom.Operator"]);

export function createApp(config, { checkDependencies, logger = console, readinessTimeoutMs = 15000 } = {}) {
  if (typeof checkDependencies !== "function") throw new Error("A dependency readiness check is required");
  const app = express();
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; frame-src https://app.powerbi.com; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
      "Cache-Control": "no-store"
    });
    next();
  });
  app.get("/healthz", (_req, res) => res.json({ status: "ok", enforcementReady: false }));
  app.get("/readyz", async (_req, res) => {
    let timeout;
    try {
      loadInventory(config.inventoryPath);
      const dependencies = await Promise.race([
        checkDependencies(),
        new Promise((_resolve, reject) => {
          timeout = setTimeout(() => reject(new Error("Dependency readiness check timed out")), readinessTimeoutMs);
        })
      ]);
      res.json({ status: "ready", ...dependencies, enforcementReady: false, foundryConnection: "not-tested" });
    } catch (error) {
      logger.error("Foundation readiness failed", error);
      res.status(503).json({ status: "not_ready", enforcementReady: false });
    } finally {
      clearTimeout(timeout);
    }
  });
  app.use("/api", (req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    logger.warn("Rejected mutation: foundation has no enforcement adapter", { method: req.method, path: req.path });
    return res.status(403).json({
      code: "ENFORCEMENT_NOT_AVAILABLE",
      error: "Controls are disabled. Identify the Foundry API and implement and validate an enforcement adapter first."
    });
  });
  app.use("/api", (req, res, next) => {
    if (!config.requireAuth) {
      req.identity = { name: "Local preview (authentication disabled)", roles: ["AIControlRoom.Viewer"] };
      return next();
    }
    const encoded = req.get("x-ms-client-principal");
    if (!encoded || !req.get("x-ms-client-principal-id")) {
      return res.status(401).json({ error: "Sign in through App Service authentication", code: "AUTH_REQUIRED" });
    }
    let principal;
    try {
      principal = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
    } catch {
      logger.warn("Rejected malformed App Service principal");
      return res.status(401).json({ error: "Invalid identity", code: "INVALID_IDENTITY" });
    }
    const assignedRoles = Array.isArray(principal?.claims)
      ? principal.claims.filter((claim) => typeof claim?.typ === "string"
        && (claim.typ === "roles" || claim.typ.endsWith("/claims/role"))).map((claim) => claim.val)
      : [];
    if (!assignedRoles.some((role) => roles.has(role))) {
      return res.status(403).json({ error: "Viewer or Operator application role required", code: "ROLE_REQUIRED" });
    }
    req.identity = { name: req.get("x-ms-client-principal-name") || "Signed-in user", roles: assignedRoles };
    next();
  });
  const solutions = () => loadInventory(config.inventoryPath).map((solution) => ({
    ...solution, observedStatus: "unknown", enforcementStatus: "not-integrated", telemetryStatus: "not-connected"
  }));
  app.get("/api/config", (_req, res) => res.json({
    mode: "foundation", enableControls: false, canOperate: false,
    organizationName: config.organizationName, applicationName: config.applicationName,
    powerBiReportUrl: config.reportUrl, powerBiOpenUrl: config.openUrl
  }));
  app.get("/api/solutions", (_req, res) => res.json({ solutions: solutions() }));
  app.get("/api/control-room", (req, res) => res.json({
    solutions: solutions(), telemetry: [], commands: [],
    identity: { name: req.identity.name, canOperate: false }, generatedAt: new Date().toISOString()
  }));
  app.get("/api/solutions/:id", (req, res) => {
    const solution = solutions().find((item) => item.id === req.params.id);
    if (!solution) return res.status(404).json({ error: "Solution not registered" });
    res.json({ solution, telemetry: null, commands: [], canOperate: false });
  });
  app.use("/api", (_req, res) => res.status(404).json({ error: "API route not found" }));
  app.use(express.static(fileURLToPath(new URL("../public", import.meta.url))));
  app.use((error, _req, res, _next) => {
    logger.error("Foundation request failed", error);
    res.status(500).json({ error: "Foundation request failed; check application logs" });
  });
  return app;
}
