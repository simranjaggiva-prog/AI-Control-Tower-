function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
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
  const error = document.querySelector("#error");
  const button = document.querySelector("#refresh");
  error.hidden = true;
  button.disabled = true;
  try {
    const [config, state] = await Promise.all([request("/api/config"), request("/api/control-room")]);
    document.querySelector("#organization").textContent = config.organizationName;
    document.querySelector("#title").textContent = config.applicationName;
    document.querySelector("#identity").textContent = state.identity.name;
    document.querySelector("#count").textContent = `${state.solutions.length} registered`;
    const inventory = document.querySelector("#solutions");
    inventory.replaceChildren();
    if (!state.solutions.length) inventory.append(element("p", "No customer solutions registered. Add approved non-production metadata to config/solutions.json and redeploy.", "empty"));
    for (const solution of state.solutions) {
      const card = element("article", undefined, "solution");
      card.append(element("h3", solution.name), element("p", `Owner: ${solution.owner} | Environment: ${solution.environment}`),
        element("span", "Runtime state: unknown", "badge"), element("p", `API type: ${solution.apiType} | Enforcement: not integrated`),
        element("p", solution.foundryProjectEndpoint, "endpoint"));
      inventory.append(card);
    }
    const report = document.querySelector("#report");
    report.replaceChildren();
    if (config.powerBiOpenUrl) {
      const link = element("a", "Open authorised Power BI report");
      link.href = config.powerBiOpenUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      report.append(link);
    }
    if (config.powerBiReportUrl) {
      const frame = element("iframe");
      frame.title = "Customer Power BI report";
      frame.src = config.powerBiReportUrl;
      frame.allowFullscreen = true;
      report.append(frame);
    } else {
      report.append(element("p", "Report not configured. No telemetry values are assumed.", "empty"));
    }
  } catch (failure) {
    error.replaceChildren(element("strong", failure.message));
    const signIn = element("a", " Sign in with Microsoft Entra ID");
    signIn.href = "/.auth/login/aad?post_login_redirect_uri=/";
    error.append(signIn);
    error.hidden = false;
    document.querySelector("#solutions").replaceChildren();
    document.querySelector("#report").replaceChildren();
    document.querySelector("#count").textContent = "Unavailable";
    document.querySelector("#identity").textContent = "";
  } finally {
    button.disabled = false;
  }
}

document.querySelector("#refresh").addEventListener("click", refresh);
refresh();
