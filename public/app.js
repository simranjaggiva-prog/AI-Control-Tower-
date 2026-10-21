import { illustrativeSolutions, defaultDashboardFilters, previewDashboard, dashboardMetrics, agentMetrics, filterSolutions } from "./showcase.js";

const $ = (selector) => document.querySelector(selector);
const pages = { dashboard: "Dashboard", solutions: "Solutions", agent: "Agent detail", controls: "Controls" };
let configuration;
let state;
let selectedId = "";
let pauseState = "running";
let dashboardFilters = { ...defaultDashboardFilters };

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

function runVolumeChart(view) {
  const wrapper = element("div", undefined, "run-chart");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const number = (value) => value.toLocaleString("en-US");
  svg.setAttribute("viewBox", "0 0 960 154");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `Illustrative runs by ${view.bucketUnit}. ${view.points.map((point) => `${point.key}: ${number(point.runs)}`).join("; ")}. Total ${number(view.totals.runs)}.`);
  const max = Math.max(1, ...view.points.map((point) => point.runs));
  const step = 960 / view.points.length;
  view.points.forEach((point, index) => {
    const group = document.createElementNS(svg.namespaceURI, "g");
    const bar = document.createElementNS(svg.namespaceURI, "rect");
    const height = point.runs / max * 110;
    for (const [name, value] of Object.entries({
      x: index * step + step * .18, y: 116 - height, width: step * .64, height, rx: 2
    })) bar.setAttribute(name, String(value));
    const title = document.createElementNS(svg.namespaceURI, "title");
    title.textContent = `${point.key} UTC: ${number(point.runs)} sample runs`;
    bar.append(title);
    const label = document.createElementNS(svg.namespaceURI, "text");
    label.setAttribute("x", String((index + .5) * step));
    label.setAttribute("y", "140");
    label.setAttribute("text-anchor", "middle");
    label.textContent = point.label;
    group.append(bar, label);
    svg.append(group);
  });
  wrapper.append(svg);
  return wrapper;
}

function renderDashboard() {
  const view = isPreview() ? previewDashboard(dashboardFilters) : null;
  $("#dashboard-filters").hidden = !view;
  $("#dashboard-filter-note").textContent = view
    ? "Illustrative filters only. Business-unit assignments, agent labels and targets are fictitious; real mappings require confirmation."
    : configuration?.powerBiReportUrl
      ? "Use the filters inside your authorised Power BI report. App preview filters do not filter the report."
      : "Dashboard filters are available in Illustrative preview. Live filtering requires confirmed telemetry and business-unit mappings.";
  $("#dashboard-scope").hidden = !view;
  $("#dashboard-scope").textContent = view
    ? `Sample scope: ${dashboardFilters.businessUnit} business units / ${dashboardFilters.period} / ${$("#dashboard-filters input[name='agent']:checked + span").textContent} / ${view.coverage}. Fixed sample dates, not live data.`
    : "";
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
  $("#dashboard-cards").replaceChildren(...(view?.metrics || dashboardMetrics(false)).map(card));
  const volume = element("div", undefined, "volume");
  volume.append(element("h2", "Daily run volume", "eyebrow"));
  if (view) {
    volume.append(element("p", view.bucketUnit, "chart-unit"), runVolumeChart(view));
  } else {
    volume.append(element("p", "No verified run history connected.", "muted"));
  }
  const attention = element("div", undefined, "attention");
  attention.append(element("h2", isPreview() ? "Attention required" : "Data connection required", "eyebrow"),
    element("p", view ? view.attention : "Metrics are unavailable, not healthy or zero."));
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
    dashboard: isPreview() ? "Executive overview / Sample data in USD" : "Executive overview / Authorised report or connection readiness",
    solutions: isPreview() ? "Separate seven-day illustrative portfolio / Dashboard filters do not apply" : "Customer solution inventory",
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
  dashboardFilters = { ...defaultDashboardFilters };
  for (const [name, value] of Object.entries(dashboardFilters)) {
    $(`#dashboard-filters input[name='${name}'][value='${value}']`).checked = true;
  }
  render();
});
$("#dashboard-filters").addEventListener("change", (event) => {
  if (!(event.target instanceof HTMLInputElement) || event.target.type !== "radio") return;
  dashboardFilters = { ...dashboardFilters, [event.target.name]: event.target.value };
  renderDashboard();
});
$("#search").addEventListener("input", renderSolutions);
for (const id of ["#agent-select", "#control-select"]) $(id).addEventListener("change", (event) => {
  chooseSolution(event.target.value, id === "#agent-select" ? "agent" : "controls");
});
$("#refresh").addEventListener("click", refresh);
window.addEventListener("hashchange", navigate);
render();
refresh();
