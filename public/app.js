import { illustrativeSolutions, dailyVolumes, dashboardMetrics, agentMetrics, filterSolutions } from "./showcase.js";

const $ = (selector) => document.querySelector(selector);
const pages = { dashboard: "Dashboard", solutions: "Solutions", agent: "Agent detail", controls: "Controls" };
let configuration;
let state;
let selectedId = "";
let pauseState = "running";

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function isPreview() { return $("#preview").checked; }
function solutions() { return isPreview() ? illustrativeSolutions : state?.solutions || []; }
function selected() { return solutions().find((solution) => solution.id === selectedId); }

function card([label, value, hint, colour]) {
  const node = element("article", undefined, `metric ${colour}`);
  node.append(element("h2", label, "metric-label"), element("p", value, "metric-value"), element("p", hint, "metric-hint"));
  return node;
}

function renderDashboard() {
  const report = $("#report");
  if (isPreview() || !configuration?.powerBiReportUrl) {
    report.replaceChildren();
  } else if (report.firstElementChild?.getAttribute("src") !== configuration.powerBiReportUrl) {
    const frame = element("iframe");
    frame.title = "Authorised Power BI dashboard";
    frame.src = configuration.powerBiReportUrl;
    frame.allowFullscreen = true;
    report.replaceChildren(frame);
  }
  const embedded = !isPreview() && Boolean(configuration?.powerBiReportUrl);
  $("#dashboard-cards").hidden = embedded;
  $("#dashboard-summary").hidden = embedded;
  $("#dashboard-cards").replaceChildren(...dashboardMetrics(isPreview()).map(card));
  const volume = element("div", undefined, "volume");
  volume.append(element("h2", "Daily run volume", "eyebrow"));
  if (isPreview()) {
    const bars = element("div", undefined, "bars");
    bars.setAttribute("role", "img");
    bars.setAttribute("aria-label", `Illustrative seven-day run volumes: ${dailyVolumes.join(", ")}. Total 12,480.`);
    dailyVolumes.forEach((value, index) => {
      const bar = element("span", undefined, `bar level-${index + 1}`);
      bar.title = `Sample day ${index + 1}: ${value.toLocaleString("en-US")} runs`;
      bars.append(bar);
    });
    volume.append(bars);
  } else {
    volume.append(element("p", "No verified run history connected.", "muted"));
  }
  const attention = element("div", undefined, "attention");
  attention.append(element("h2", isPreview() ? "Attention required" : "Data connection required", "eyebrow"),
    element("p", isPreview() ? "SLA below target / 3 safety breaches" : "Metrics are unavailable, not healthy or zero."));
  $("#dashboard-summary").replaceChildren(volume, attention);
}

function chooseSolution(id, page) {
  selectedId = id;
  pauseState = "running";
  renderSelections();
  renderAgent();
  renderControls();
  if (location.hash === `#${page}`) navigate();
  else location.hash = page;
}

function renderSolutions() {
  const filtered = filterSolutions(solutions(), $("#search").value);
  $("#count").textContent = `${filtered.length} of ${solutions().length} ${isPreview() ? "illustrative" : "registered"}`;
  const list = $("#solution-list");
  list.replaceChildren();
  if (!filtered.length) {
    list.append(element("p", solutions().length ? "No solutions match your search." : "No customer solutions registered. Add approved metadata to config/solutions.json. Registration does not connect telemetry or controls.", "empty"));
  }
  for (const solution of filtered) {
    const row = element("article", undefined, `solution${isPreview() && solution.breaches ? " review" : ""}`);
    const detail = element("div");
    detail.append(element("h2", solution.name), element("p", isPreview()
      ? `${solution.runs.toLocaleString("en-US")} runs | ${solution.breaches} safety ${solution.breaches === 1 ? "breach" : "breaches"}`
      : `Owner: ${solution.owner} | Runtime state: unknown`, "muted"));
    const actions = element("div", undefined, "solution-actions");
    actions.append(element("span", isPreview() ? (solution.breaches ? "Needs review" : "No safety breaches") : "Telemetry not connected",
      `badge ${isPreview() ? (solution.breaches ? "status-review" : "status-good") : ""}`));
    const button = element("button", "View solution");
    button.type = "button";
    button.setAttribute("aria-label", `View solution: ${solution.name}`);
    button.addEventListener("click", () => chooseSolution(solution.id, "agent"));
    actions.append(button);
    row.append(detail, actions);
    list.append(row);
  }
}

function renderSelections() {
  const entries = solutions();
  if (!entries.some((solution) => solution.id === selectedId)) selectedId = entries[0]?.id || "";
  for (const id of ["#agent-select", "#control-select"]) {
    const select = $(id);
    select.replaceChildren();
    if (!entries.length) select.append(new Option("No registered solutions", ""));
    for (const solution of entries) select.append(new Option(solution.name, solution.id));
    select.value = selectedId;
    select.disabled = entries.length === 0;
  }
}

function renderAgent() {
  const solution = selected();
  $("#agent-context").textContent = solution
    ? `${solution.name} / ${isPreview() ? "Illustrative operational view; mappings to confirm" : "Registered metadata only; runtime status unknown"}`
    : "Select a registered solution after configuring your inventory.";
  $("#agent-cards").replaceChildren(...agentMetrics(isPreview(), selectedId).map(card));
  const timeline = $("#timeline");
  timeline.replaceChildren();
  if (isPreview() && selectedId === "preview-noc") {
    const track = element("div", undefined, "timeline-track");
    track.setAttribute("role", "img");
    track.setAttribute("aria-label", "Illustrative NOC execution windows: 01 to 04, 07 to 11, and 14 to 20 hours.");
    for (let index = 1; index <= 3; index++) track.append(element("span", undefined, `window window-${index}`));
    const axis = element("div", undefined, "timeline-axis");
    for (const hour of ["00", "04", "08", "12", "16", "20", "24"]) axis.append(element("span", hour));
    timeline.append(track, axis, element("p", "Sample execution windows (hours) - not actual agent activity.", "muted"));
  } else {
    timeline.append(element("p", "Timeline unavailable. Reliable execution start/end timestamps and agent mappings are required.", "empty"));
  }
  const components = $("#components");
  components.replaceChildren(element("h2", "Components & trends"));
  const detail = element("div", undefined, "component-layout");
  detail.append(element("p", isPreview() && selectedId === "preview-noc"
    ? "Sample: model healthy / tool latency warning" : "Component health and request trends are not connected.", "warning-text"));
  if (isPreview() && selectedId === "preview-noc") {
    detail.append(element("p", "Sample request trend (5 min): 8 / 10 / 9 / 14 / 12 RPM", "muted"));
  }
  components.append(detail);
}

function renderControls() {
  const root = $("#control-content");
  root.replaceChildren();
  if (!isPreview() || !selected()) {
    const panel = element("div", undefined, "panel");
    panel.append(element("h2", "Pause agent unavailable"), element("p", "No runtime enforcement adapter is integrated. Registration and Operator permissions do not enable pause, stop or resume."));
    const button = element("button", "Pause unavailable - adapter not integrated");
    button.type = "button";
    button.disabled = true;
    panel.append(button, element("p", "Runtime state: unknown. Controls remain disabled server-side.", "muted"));
    root.append(panel);
    return;
  }
  const panel = element("div", undefined, "pause-panel");
  panel.append(element("h2", `Pause ${selected().name} agent?`),
    element("p", "Illustrative local simulation only. No command is sent to an agent. A real pause occurs at the next supported execution check."));
  const label = element("label", "Reason for pause");
  label.htmlFor = "pause-reason";
  const reason = element("textarea");
  reason.id = "pause-reason";
  reason.placeholder = "For example: investigate a service issue";
  reason.maxLength = 500;
  reason.disabled = pauseState !== "running";
  const status = element("p", pauseState === "running" ? "Simulation state: Running"
    : pauseState === "pending" ? "Simulation state: Pause pending - no runtime confirmation received"
      : "Simulation state: Paused - acknowledgement was simulated, not received from a runtime");
  status.id = "control-status";
  status.setAttribute("role", "status");
  const actions = element("div", undefined, "button-row");
  const confirm = element("button", "Confirm pause (simulation)", "danger");
  confirm.type = "button";
  confirm.disabled = true;
  reason.addEventListener("input", () => { confirm.disabled = !reason.value.trim(); });
  confirm.addEventListener("click", () => {
    if (!reason.value.trim()) return;
    pauseState = "pending";
    renderControls();
    $("#simulate-ack").focus();
  });
  if (pauseState === "running") actions.append(confirm);
  if (pauseState === "pending") {
    const acknowledge = element("button", "Simulate runtime acknowledgement");
    acknowledge.id = "simulate-ack";
    acknowledge.type = "button";
    acknowledge.addEventListener("click", () => { pauseState = "paused"; renderControls(); $("#reset-simulation").focus(); });
    actions.append(acknowledge);
  }
  const reset = element("button", pauseState === "paused" ? "Reset / resume simulation" : "Cancel / reset simulation");
  reset.id = "reset-simulation";
  reset.type = "button";
  reset.addEventListener("click", () => { pauseState = "running"; renderControls(); $("#pause-reason").focus(); });
  actions.append(reset);
  panel.append(label, reason, actions, status);
  const states = element("div", undefined, "metric-grid control-states");
  states.append(...[
    ["Before action", "Running", "Illustrative starting state", "green"],
    ["After request", "Pause pending", "Await runtime confirmation", "amber"],
    ["After verification", "Paused", "Only if runtime confirms; simulated here", "blue"]
  ].map(card));
  root.append(panel, states);
}

function navigate() {
  const aliases = { inventory: "solutions", analytics: "dashboard" };
  const hash = location.hash.slice(1);
  const page = Object.hasOwn(pages, hash) ? hash : aliases[hash] || "dashboard";
  for (const key of Object.keys(pages)) {
    $(`#${key}`).hidden = key !== page;
    const link = $(`.primary-nav a[href="#${key}"]`);
    if (key === page) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  $("#page-title").textContent = pages[page];
  $("#page-context").textContent = {
    dashboard: isPreview() ? "Executive overview / Last 7 days / Sample data in USD" : "Executive overview / Authorised report or connection readiness",
    solutions: isPreview() ? "Last 7 days / Illustrative portfolio" : "Customer solution inventory",
    agent: "Operational performance / Solution-to-agent drilldown",
    controls: isPreview() ? "Kill switch / Illustrative pause walkthrough" : "Control readiness / Runtime integration required"
  }[page];
  $("#powerbi-open").hidden = page !== "dashboard" || isPreview() || !configuration?.powerBiOpenUrl;
  document.title = `${pages[page]} | ${configuration?.applicationName || "AI Control Tower"}`;
}

function render() {
  const preview = isPreview();
  const mufg = preview || configuration?.organizationName.toUpperCase() === "MUFG";
  $("#mufg-logo").hidden = !mufg;
  $("#organization").hidden = mufg;
  $("#organization").textContent = configuration?.organizationName || "Customer";
  $("#application-name").textContent = configuration?.applicationName || "AI Control Tower";
  $("#mode-badge").textContent = preview ? "ILLUSTRATIVE VIEW" : "READ-ONLY FOUNDATION";
  $("#mode-notice").className = `notice${preview ? " preview" : ""}`;
  $("#mode-notice").textContent = preview
    ? "Design preview: all figures, targets, agents and statuses below are fictitious examples, not actual MUFG results. Pause actions are local simulations only."
    : "Read-only foundation. Telemetry values are not assumed. A configured Power BI report uses its own data and freshness settings; runtime controls are not connected.";
  $("#disclaimer").textContent = preview ? "DESIGN PREVIEW / Illustrative content - not actual MUFG results" : "CUSTOMER FOUNDATION / No live runtime enforcement";
  if (configuration?.powerBiOpenUrl) $("#powerbi-open").href = configuration.powerBiOpenUrl;
  else $("#powerbi-open").removeAttribute("href");
  renderDashboard();
  renderSolutions();
  renderSelections();
  renderAgent();
  renderControls();
  navigate();
}

async function request(path) {
  const response = await fetch(path);
  if (!response.ok) {
    const body = await response.json();
    throw new Error(body.error || `Request failed (${response.status})`);
  }
  return response.json();
}

async function refresh() {
  $("#error").hidden = true;
  $("#refresh").disabled = true;
  try {
    const [config, room] = await Promise.all([request("/api/config"), request("/api/control-room")]);
    configuration = config;
    state = room;
    $("#identity").textContent = room.identity.name;
  } catch (failure) {
    configuration = undefined;
    state = undefined;
    $("#identity").textContent = "Connection unavailable";
    $("#error").replaceChildren(element("strong", failure.message));
    const signIn = element("a", " Sign in with Microsoft Entra ID");
    signIn.href = "/.auth/login/aad?post_login_redirect_uri=/";
    $("#error").append(signIn);
    $("#error").hidden = false;
  } finally {
    render();
    $("#refresh").disabled = false;
  }
}

$("#preview").addEventListener("change", () => {
  selectedId = "";
  pauseState = "running";
  $("#search").value = "";
  render();
});
$("#search").addEventListener("input", renderSolutions);
for (const id of ["#agent-select", "#control-select"]) $(id).addEventListener("change", (event) => {
  chooseSolution(event.target.value, id === "#agent-select" ? "agent" : "controls");
});
$("#refresh").addEventListener("click", refresh);
window.addEventListener("hashchange", navigate);
render();
refresh();
