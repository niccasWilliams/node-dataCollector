const ACTION_TABS = [
  { id: "status", label: "Status" },
  { id: "navigation", label: "Navigation" },
  { id: "interactions", label: "Interaktionen" },
  { id: "analysis", label: "Analyse & Inhalte" },
  { id: "session", label: "Session" },
];

let activeTabId = "navigation";

function setupFillFormAction(ctx) {
  const { form, fieldContainer, showError, run } = ctx;
  fieldContainer.innerHTML = "";

  const hint = document.createElement("p");
  hint.className = "form-hint";
  hint.textContent =
    'Füge einzelne Formularfelder hinzu. Wir füllen sie in der angegebenen Reihenfolge aus und lösen anschließend den Submit aus.';
  fieldContainer.appendChild(hint);

  const builder = document.createElement("div");
  builder.className = "form-builder";
  fieldContainer.appendChild(builder);

  const emptyState = document.createElement("div");
  emptyState.className = "form-builder__empty";
  emptyState.textContent = 'Noch keine Felder. Klicke auf "Feld hinzufügen".';
  builder.appendChild(emptyState);

  const toolbar = document.createElement("div");
  toolbar.className = "form-builder__toolbar";
  const addButton = document.createElement("button");
  addButton.type = "button";
  addButton.className = "secondary has-icon";
  const addIcon = document.createElement("span");
  addIcon.setAttribute("aria-hidden", "true");
  addIcon.textContent = "+";
  addButton.appendChild(addIcon);
  addButton.append("Feld hinzufügen");
  toolbar.appendChild(addButton);
  fieldContainer.appendChild(toolbar);

  const submitLabel = document.createElement("label");
  submitLabel.textContent = "Submit-Button Selector";
  const submitInput = document.createElement("input");
  submitInput.type = "text";
  submitInput.placeholder = "button[type='submit']";
  submitInput.value = "button[type='submit']";
  submitInput.required = true;
  submitInput.name = "submitSelector";
  submitLabel.appendChild(submitInput);
  fieldContainer.appendChild(submitLabel);

  function updateState() {
    const rows = builder.querySelectorAll(".form-builder__row");
    emptyState.style.display = rows.length ? "none" : "block";
    rows.forEach((row) => {
      const removeBtn = row.querySelector("button.icon-button");
      if (!removeBtn) return;
      const single = rows.length === 1;
      removeBtn.disabled = single;
      removeBtn.style.visibility = single ? "hidden" : "visible";
    });
  }

  function addRow(initial = {}) {
    const row = document.createElement("div");
    row.className = "form-builder__row";

    const selectorInput = document.createElement("input");
    selectorInput.type = "text";
    selectorInput.placeholder = "CSS-Selector (z. B. input[name='email'])";
    selectorInput.value = initial.selector || "";
    selectorInput.required = true;
    selectorInput.dataset.role = "selector";

    const valueInput = document.createElement("input");
    valueInput.type = "text";
    valueInput.placeholder = "Wert (z. B. max@example.com)";
    valueInput.value = initial.value ?? "";
    valueInput.dataset.role = "value";

    const actions = document.createElement("div");
    actions.className = "form-builder__row-actions";

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "icon-button";
    removeBtn.innerHTML = "&times;";
    removeBtn.title = "Feld entfernen";
    removeBtn.addEventListener("click", () => {
      row.remove();
      updateState();
    });

    actions.appendChild(removeBtn);

    [selectorInput, valueInput].forEach((input) => {
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          if (input === valueInput) {
            addRow({});
          } else {
            valueInput.focus();
          }
        }
      });
    });

    row.appendChild(selectorInput);
    row.appendChild(valueInput);
    row.appendChild(actions);
    builder.appendChild(row);
    updateState();
    selectorInput.focus();
  }

  addButton.addEventListener("click", () => addRow({}));
  addRow({});

  return {
    submitLabel: "Formular ausfüllen",
    onSubmit: async (event) => {
      event.preventDefault();
      const submitSelector = submitInput.value.trim();
      if (!submitSelector) {
        showError("Bitte einen Submit-Selector angeben.");
        submitInput.focus();
        return;
      }

      const rows = Array.from(builder.querySelectorAll(".form-builder__row"));
      if (!rows.length) {
        showError("Füge mindestens ein Eingabefeld hinzu.");
        return;
      }

      const fields = [];
      for (const row of rows) {
        const selectorEl = row.querySelector('input[data-role="selector"]');
        const valueEl = row.querySelector('input[data-role="value"]');
        const selector = selectorEl?.value.trim() || "";
        const value = valueEl?.value ?? "";
        if (!selector) {
          showError("Jedes Feld benötigt einen CSS-Selector.");
          selectorEl?.focus();
          return;
        }
        fields.push({ selector, value });
      }

      await run({
        fields,
        submitSelector,
      });
    },
  };
}

const ACTIONS = [
  {
    id: "overview",
    label: "Session-Status aktualisieren",
    method: "GET",
    path: (id) => `/browser/session/${id}`,
    category: "status",
  },
  {
    id: "isLoggedIn",
    label: "Login-Status prüfen",
    method: "POST",
    path: (id) => `/browser/session/${id}/is-logged-in`,
    category: "status",
  },
  {
    id: "navigate",
    label: "Zu URL navigieren",
    method: "POST",
    path: (id) => `/browser/session/${id}/navigate`,
    category: "navigation",
    fields: [
      { name: "url", label: "URL", type: "url", required: true },
      {
        name: "options",
        label: "Optionen (JSON)",
        type: "textarea",
        placeholder: '{"waitUntil":"networkidle"}',
        parseAs: "json",
      },
    ],
    refreshSessions: true,
  },
  {
    id: "navigateAndWait",
    label: "Navigiere & warte auf Selector",
    method: "POST",
    path: (id) => `/browser/session/${id}/navigate-and-wait`,
    category: "navigation",
    fields: [
      { name: "url", label: "URL", type: "url", required: true },
      { name: "selector", label: "CSS-Selector", type: "text", required: true },
      {
        name: "options",
        label: "Warte-Optionen (JSON)",
        type: "textarea",
        placeholder: '{"timeout":15000}',
        parseAs: "json",
      },
    ],
    refreshSessions: true,
  },
  {
    id: "back",
    label: "Zurück (History)",
    method: "POST",
    path: (id) => `/browser/session/${id}/back`,
    category: "navigation",
    refreshSessions: true,
  },
  {
    id: "forward",
    label: "Vor (History)",
    method: "POST",
    path: (id) => `/browser/session/${id}/forward`,
    category: "navigation",
    refreshSessions: true,
  },
  {
    id: "reload",
    label: "Seite neu laden",
    method: "POST",
    path: (id) => `/browser/session/${id}/reload`,
    category: "navigation",
  },
  {
    id: "click",
    label: "Element klicken",
    method: "POST",
    path: (id) => `/browser/session/${id}/click`,
    category: "interactions",
    fields: [{ name: "selector", label: "CSS-Selector", type: "text", required: true }],
  },
  {
    id: "type",
    label: "Text eingeben",
    method: "POST",
    path: (id) => `/browser/session/${id}/type`,
    category: "interactions",
    fields: [
      { name: "selector", label: "CSS-Selector", type: "text", required: true },
      { name: "text", label: "Text", type: "text", required: true },
    ],
  },
  {
    id: "selectOption",
    label: "Dropdown Option wählen",
    method: "POST",
    path: (id) => `/browser/session/${id}/select`,
    category: "interactions",
    fields: [
      { name: "selector", label: "CSS-Selector", type: "text", required: true },
      { name: "value", label: "Value", type: "text", required: true },
    ],
  },
  {
    id: "hover",
    label: "Element hover",
    method: "POST",
    path: (id) => `/browser/session/${id}/hover`,
    category: "interactions",
    fields: [{ name: "selector", label: "CSS-Selector", type: "text", required: true }],
  },
  {
    id: "scroll",
    label: "Scrollen",
    method: "POST",
    path: (id) => `/browser/session/${id}/scroll`,
    category: "interactions",
    fields: [
      { name: "x", label: "X", type: "number", step: 10 },
      { name: "y", label: "Y", type: "number", step: 10 },
    ],
  },
  {
    id: "waitFor",
    label: "Auf Selector warten",
    method: "POST",
    path: (id) => `/browser/session/${id}/wait`,
    category: "interactions",
    fields: [
      { name: "selector", label: "CSS-Selector", type: "text", required: true },
      {
        name: "options",
        label: "Warte-Optionen (JSON)",
        type: "textarea",
        placeholder: '{"timeout":10000,"state":"visible"}',
        parseAs: "json",
      },
    ],
  },
  {
    id: "fillForm",
    label: "Formular ausfüllen",
    method: "POST",
    path: (id) => `/browser/session/${id}/fill-form`,
    category: "interactions",
    setup: setupFillFormAction,
  },
  {
    id: "screenshot",
    label: "Screenshot aufnehmen",
    method: "POST",
    path: (id) => `/browser/session/${id}/screenshot`,
    category: "analysis",
    fields: [
      { name: "fullPage", label: "Vollständige Seite", type: "checkbox" },
      {
        name: "type",
        label: "Format",
        type: "select",
        options: [
          { value: "", label: "Standard (png)" },
          { value: "png", label: "PNG" },
          { value: "jpeg", label: "JPEG" },
        ],
      },
      { name: "quality", label: "Qualität (JPEG)", type: "number", min: 0, max: 100 },
    ],
  },
  {
    id: "pageInfo",
    label: "Seiteninformationen anzeigen",
    method: "GET",
    path: (id) => `/browser/session/${id}/info`,
    category: "analysis",
  },
  {
    id: "pageHtml",
    label: "Seiten HTML abrufen",
    method: "GET",
    path: (id) => `/browser/session/${id}/html`,
    category: "analysis",
  },
  {
    id: "pageElements",
    label: "Elemente scannen",
    method: "GET",
    path: (id) => `/browser/session/${id}/elements`,
    category: "analysis",
    fields: [
      {
        name: "tags",
        label: "Tags (Kommagetrennt)",
        type: "text",
        placeholder: "button,input,form",
      },
      { name: "includeHidden", label: "Versteckte Elemente", type: "checkbox" },
      { name: "limit", label: "Limit", type: "number", min: 1, max: 500 },
    ],
  },
  {
    id: "evaluate",
    label: "Custom Script (Function)",
    method: "POST",
    path: (id) => `/browser/session/${id}/evaluate`,
    category: "analysis",
    fields: [
      {
        name: "script",
        label: "Funktions-Body",
        type: "textarea",
        placeholder: "() => document.title",
        required: true,
      },
    ],
  },
  {
    id: "logout",
    label: "Logout versuchen",
    method: "POST",
    path: (id) => `/browser/session/${id}/logout`,
    category: "session",
    fields: [
      {
        name: "selectors",
        label: "Selektoren (JSON-Array)",
        type: "textarea",
        placeholder: '["button.logout","a[href*=signout]"]',
        parseAs: "json",
      },
      {
        name: "keywords",
        label: "Zusatz-Keywords (JSON-Array)",
        type: "textarea",
        placeholder: '["logout","abmelden"]',
        parseAs: "json",
      },
      {
        name: "waitForNavigation",
        label: "Auf Navigation warten",
        type: "checkbox",
        default: true,
      },
      { name: "timeout", label: "Timeout (ms)", type: "number", min: 1000, step: 500 },
    ],
  },
  {
    id: "closeSession",
    label: "Session schließen",
    method: "DELETE",
    path: (id) => `/browser/session/${id}`,
    category: "session",
    refreshSessions: true,
  },
];

const sessionsContainer = document.querySelector("#sessions");
const actionPanel = document.querySelector("#action-panel");
const actionTitle = document.querySelector("#action-title");
const refreshButton = document.querySelector("#refresh-button");
const createSessionForm = document.querySelector("#create-session-form");
const createSessionResult = document.querySelector("#create-session-result");
const createSessionResultPre = createSessionResult?.querySelector("pre");
const configTextarea = document.querySelector("#create-session-config");

let sessionCache = [];
let selectedSessionId = null;

refreshButton?.addEventListener("click", () => loadSessions(true));

createSessionForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = {};
  const configValue = configTextarea.value.trim();

  if (configValue) {
    try {
      payload.config = JSON.parse(configValue);
    } catch (error) {
      showCreateSessionResult({ error: "Config JSON ungültig: " + error.message });
      return;
    }
  }

  showCreateSessionResult("wird erstellt...");

  try {
    const response = await fetch("/browser/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    showCreateSessionResult(data);

    if (response.ok) {
      await loadSessions(false);
      configTextarea.value = "";
    }
  } catch (error) {
    showCreateSessionResult({ error: error.message });
  }
});

function showCreateSessionResult(message) {
  if (!createSessionResult || !createSessionResultPre) return;
  createSessionResult.hidden = false;
  createSessionResultPre.textContent =
    typeof message === "string" ? message : JSON.stringify(message, null, 2);
}

function renderSessions(sessions) {
  sessionCache = sessions;
  sessionsContainer.innerHTML = "";

  if (!sessions.length) {
    const placeholder = document.createElement("div");
    placeholder.className = "placeholder";
    placeholder.textContent = "Keine aktiven Sessions.";
    sessionsContainer.appendChild(placeholder);
    selectedSessionId = null;
    renderActionPanel();
    return;
  }

  sessions.forEach((session) => {
    const card = document.createElement("article");
    card.className = "session-card";
    card.dataset.sessionId = session.id;

    if (session.id === selectedSessionId) {
      card.classList.add("active");
    }

    const title = document.createElement("h3");
    title.textContent = session.id;

    const meta = document.createElement("div");
    meta.className = "meta";

    const status = document.createElement("span");
    status.textContent = `Status: ${session.status}`;

    const url = document.createElement("span");
    url.textContent = `URL: ${session.currentUrl || "–"}`;

    const lastActivity = document.createElement("span");
    const lastActivityDate = session.lastActivityAt ? new Date(session.lastActivityAt) : null;
    lastActivity.textContent = `Zuletzt aktiv: ${
      lastActivityDate ? lastActivityDate.toLocaleString() : "–"
    }`;

    meta.append(status, url, lastActivity);
    card.append(title, meta);

    card.addEventListener("click", () => {
      selectedSessionId = session.id;
      document
        .querySelectorAll(".session-card")
        .forEach((el) => el.classList.toggle("active", el === card));
      renderActionPanel();
    });

    sessionsContainer.appendChild(card);
  });

  if (!selectedSessionId) {
    selectedSessionId = sessions[0].id;
    sessionsContainer.firstElementChild?.classList.add("active");
    renderActionPanel();
  }
}

function renderActionPanel() {
  if (!selectedSessionId) {
    actionTitle.textContent = "Aktionen";
    actionPanel.classList.add("placeholder");
    actionPanel.textContent = "Wähle links eine Session aus, um Aktionen auszuführen.";
    return;
  }

  const session = sessionCache.find((s) => s.id === selectedSessionId);
  actionTitle.textContent = `Aktionen für ${selectedSessionId}`;
  actionPanel.classList.remove("placeholder");
  actionPanel.innerHTML = "";

  const overview = createSessionOverview(session);
  actionPanel.appendChild(overview);

  const actionsByCategory = groupActionsByCategory();
  const availableTabs = ACTION_TABS.filter((tab) => actionsByCategory[tab.id]?.length);

  if (!availableTabs.length) {
    const empty = document.createElement("div");
    empty.className = "placeholder";
    empty.textContent = "Für diese Session sind aktuell keine Aktionen verfügbar.";
    actionPanel.appendChild(empty);
    return;
  }

  if (!availableTabs.some((tab) => tab.id === activeTabId)) {
    activeTabId = availableTabs[0].id;
  }

  const tabNav = document.createElement("div");
  tabNav.className = "tab-nav";

  availableTabs.forEach((tab) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `tab-button${tab.id === activeTabId ? " active" : ""}`;
    button.textContent = tab.label;
    button.addEventListener("click", () => {
      activeTabId = tab.id;
      renderActionPanel();
    });
    tabNav.appendChild(button);
  });

  actionPanel.appendChild(tabNav);

  const tabContent = document.createElement("div");
  tabContent.className = "tab-content";

  const actionGrid = document.createElement("div");
  actionGrid.className = "action-grid";

  const actionsForTab = actionsByCategory[activeTabId] || [];
  actionsForTab.forEach((action) => {
    const block = createActionBlock(action, selectedSessionId);
    actionGrid.appendChild(block);
  });

  tabContent.appendChild(actionGrid);
  actionPanel.appendChild(tabContent);
}

function createSessionOverview(session) {
  const container = document.createElement("div");
  container.className = "action-block session-overview";

  const title = document.createElement("h3");
  title.className = "session-overview__title";
  title.textContent = "Session Überblick";
  container.appendChild(title);

  const meta = document.createElement("div");
  meta.className = "session-overview__meta";

  const metaItems = [
    { label: "Status", value: session?.status || "unbekannt" },
    {
      label: "Aktuelle URL",
      value: session?.currentUrl || "–",
      isLink: Boolean(session?.currentUrl),
    },
    {
      label: "Zuletzt aktiv",
      value: session?.lastActivityAt
        ? new Date(session.lastActivityAt).toLocaleString()
        : "–",
    },
  ];

  metaItems.forEach(({ label, value, isLink }) => {
    const row = document.createElement("span");
    const strong = document.createElement("strong");
    strong.textContent = `${label}:`;
    row.appendChild(strong);

    if (isLink) {
      const link = document.createElement("a");
      link.href = value;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = value;
      link.classList.add("muted");
      row.appendChild(link);
    } else {
      const text = document.createElement("span");
      text.textContent = value;
      text.classList.add("muted");
      row.appendChild(text);
    }

    meta.appendChild(row);
  });

  container.appendChild(meta);
  return container;
}

function createActionBlock(action, sessionId) {
  const block = document.createElement("div");
  block.className = "action-block";

  const titleRow = document.createElement("div");
  titleRow.style.display = "flex";
  titleRow.style.justifyContent = "space-between";
  titleRow.style.alignItems = "center";

  const heading = document.createElement("h3");
  heading.textContent = action.label;
  heading.style.margin = "0 12px 8px 0";
  titleRow.appendChild(heading);

  const methodBadge = document.createElement("span");
  methodBadge.textContent = action.method;
  methodBadge.style.fontSize = "0.75rem";
  methodBadge.style.padding = "4px 8px";
  methodBadge.style.borderRadius = "999px";
  methodBadge.style.background =
    action.method === "GET"
      ? "rgba(74, 222, 128, 0.18)"
      : action.method === "DELETE"
      ? "rgba(248, 113, 113, 0.18)"
      : "rgba(14, 165, 233, 0.18)";
  methodBadge.style.color =
    action.method === "GET"
      ? "var(--success)"
      : action.method === "DELETE"
      ? "var(--danger)"
      : "var(--accent)";

  titleRow.appendChild(methodBadge);
  block.appendChild(titleRow);

  const form = document.createElement("form");
  form.dataset.actionId = action.id;

  const fieldContainer = document.createElement("div");
  fieldContainer.className = "form-field-set";
  form.appendChild(fieldContainer);

  (action.fields || []).forEach((field) => {
    const label = document.createElement("label");
    label.textContent = field.label;

    let input;
    if (field.type === "textarea") {
      input = document.createElement("textarea");
    } else if (field.type === "select") {
      input = document.createElement("select");
      (field.options || []).forEach((opt) => {
        const option = document.createElement("option");
        option.value = opt.value;
        option.textContent = opt.label;
        input.appendChild(option);
      });
    } else if (field.type === "checkbox") {
      input = document.createElement("input");
      input.type = "checkbox";
      if (field.default) {
        input.checked = true;
      }
    } else {
      input = document.createElement("input");
      input.type = field.type || "text";
    }

    input.name = field.name;
    if (field.placeholder && field.type !== "checkbox") {
      input.placeholder = field.placeholder;
    }

    if (field.required) {
      input.required = true;
    }

    if (field.min !== undefined) input.min = String(field.min);
    if (field.max !== undefined) input.max = String(field.max);
    if (field.step !== undefined) input.step = String(field.step);

    label.appendChild(input);
    fieldContainer.appendChild(label);
  });

  const result = document.createElement("div");
  result.className = "action-result";
  result.hidden = true;
  const pre = document.createElement("pre");
  result.appendChild(pre);

  const customSetup =
    typeof action.setup === "function"
      ? action.setup({
          form,
          fieldContainer,
          action,
          sessionId,
          resultContainer: result,
          resultPre: pre,
          run: (payload) => runAction(sessionId, action, form, result, pre, payload),
          showError: (message) => {
            result.hidden = false;
            pre.textContent = "Fehler: " + message;
          },
        })
      : null;

  const submitButton = document.createElement("button");
  submitButton.type = "submit";
  submitButton.textContent =
    customSetup?.submitLabel ||
    (action.method === "DELETE" ? "Session schließen" : "Ausführen");
  if (action.method === "DELETE") {
    submitButton.classList.add("danger");
  }
  if (customSetup?.submitClassName) {
    submitButton.classList.add(customSetup.submitClassName);
  }
  form.appendChild(submitButton);

  const submitHandler =
    customSetup?.onSubmit ||
    (async (event) => {
      event.preventDefault();
      await runAction(sessionId, action, form, result, pre);
    });

  form.addEventListener("submit", submitHandler);

  block.appendChild(form);
  block.appendChild(result);
  return block;
}

async function runAction(sessionId, action, form, resultContainer, pre, overridePayload) {
  resultContainer.hidden = false;
  pre.textContent = "Wird ausgeführt...";

  try {
    const { url, options } =
      overridePayload && Object.keys(overridePayload).length
        ? buildRequestFromPayload(sessionId, action, overridePayload)
        : buildRequest(sessionId, action, form);
    const response = await fetch(url, options);

    let data;
    const text = await response.text();
    try {
      data = text ? JSON.parse(text) : {};
    } catch (error) {
      data = { raw: text };
    }

    if (!response.ok) {
      throw new Error(data?.error || response.statusText);
    }

    if (action.refreshSessions) {
      await loadSessions(true);
    }

    pre.textContent = JSON.stringify(data, null, 2);

    if (action.id === "screenshot" && data?.data?.url) {
      pre.textContent += "\nScreenshot: " + data.data.url;
    }
  } catch (error) {
    pre.textContent = "Fehler: " + error.message;
  }
}

function buildRequest(sessionId, action, form) {
  const formData = new FormData(form);
  const method = action.method || "GET";
  let url = action.path(sessionId);
  const headers = {};
  let body = null;

  const payload = {};
  const query = new URLSearchParams();

  (action.fields || []).forEach((field) => {
    const rawValue = formData.get(field.name);
    let value = rawValue;

    if (field.type === "checkbox") {
      value = form.elements[field.name].checked;
    } else if (field.parseAs === "json" && rawValue) {
      if (typeof rawValue === "string" && rawValue.trim().length) {
        try {
          value = JSON.parse(rawValue);
        } catch (error) {
          throw new Error(`${field.label}: JSON ungültig (${error.message})`);
        }
      } else {
        value = undefined;
      }
    } else if (field.type === "number" && rawValue) {
      value = Number(rawValue);
      if (Number.isNaN(value)) {
        throw new Error(`${field.label}: Zahl erwartet`);
      }
    } else if (typeof rawValue === "string") {
      value = rawValue.trim();
    }

    if (value === undefined || value === "" || value === null) {
      return;
    }

    payload[field.name] = value;
    query.set(field.name, String(value));
  });

  if (method === "GET") {
    const queryString = query.toString();
    if (queryString) {
      url += (url.includes("?") ? "&" : "?") + queryString;
    }
  } else if (method !== "DELETE") {
    body = JSON.stringify(payload);
    headers["Content-Type"] = "application/json";
  }

  return { url, options: { method, headers, body } };
}

function buildRequestFromPayload(sessionId, action, payload) {
  const method = action.method || "GET";
  let url = action.path(sessionId);
  const headers = {};
  let body = undefined;

  if (method === "GET") {
    const params = new URLSearchParams();
    Object.entries(payload).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        return;
      }
      if (Array.isArray(value) || typeof value === "object") {
        params.set(key, JSON.stringify(value));
      } else {
        params.set(key, String(value));
      }
    });
    const queryString = params.toString();
    if (queryString) {
      url += (url.includes("?") ? "&" : "?") + queryString;
    }
  } else if (method !== "DELETE") {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(payload);
  }

  return {
    url,
    options: {
      method,
      headers,
      body,
    },
  };
}

function groupActionsByCategory() {
  return ACTIONS.reduce((acc, action) => {
    const key = action.category || "session";
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(action);
    return acc;
  }, {});
}

async function loadSessions(preserveSelection = true) {
  try {
    const response = await fetch("/browser/sessions");
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || "Konnte Sessions nicht laden");
    }

    if (!preserveSelection) {
      selectedSessionId = null;
    } else if (
      selectedSessionId &&
      !data.data.some((session) => session.id === selectedSessionId)
    ) {
      selectedSessionId = null;
    }

    renderSessions(data.data || []);
  } catch (error) {
    sessionsContainer.innerHTML = "";
    const placeholder = document.createElement("div");
    placeholder.className = "placeholder";
    placeholder.textContent = "Fehler beim Laden der Sessions: " + error.message;
    sessionsContainer.appendChild(placeholder);
  }
}

loadSessions(false);
