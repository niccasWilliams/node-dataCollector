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

const sessionListContainer = document.querySelector("#session-list");
const sessionViewButtons = document.querySelectorAll(".session-tabs [data-view]");
const badgeActive = document.querySelector("#badge-active");
const badgeHistory = document.querySelector("#badge-history");
const statActive = document.querySelector("#stat-active");
const statHistory = document.querySelector("#stat-history");
const statLastActivity = document.querySelector("#stat-last-activity");
const previewContent = document.querySelector("#preview-content");
const captureSnapshotButton = document.querySelector("#capture-snapshot-button");
const openCreateSessionButton = document.querySelector("#open-create-session-modal");
const sessionModal = document.querySelector("#create-session-modal");
const sessionModalForm = document.querySelector("#create-session-form");
const closeModalButtons = document.querySelectorAll("[data-action='close-session-modal']");
const headlessInput = document.querySelector("#session-headless");
const slowMoInput = document.querySelector("#session-slowmo");
const slowMoValueLabel = document.querySelector("#session-slowmo-value");
const viewportWidthInput = document.querySelector("#session-viewport-width");
const viewportHeightInput = document.querySelector("#session-viewport-height");
const createSessionFeedback = document.querySelector("#create-session-feedback");
const createSessionFeedbackPre = createSessionFeedback?.querySelector("pre");
const actionPanel = document.querySelector("#action-panel");
const actionTitle = document.querySelector("#action-title");
const refreshButton = document.querySelector("#refresh-button");

let activeSessions = [];
let historySessions = [];
let sessionView = "active";
let selectedSessionId = null;
let selectedSessionSource = "active";
let lastPreviewRequestId = 0;

refreshButton?.addEventListener("click", () => loadSessions(true));
openCreateSessionButton?.addEventListener("click", () => openSessionModal());
closeModalButtons.forEach((button) =>
  button.addEventListener("click", () => closeSessionModal())
);
sessionModalForm?.addEventListener("submit", handleCreateSessionSubmit);
slowMoInput?.addEventListener("input", () => updateSlowMoLabel());
sessionViewButtons.forEach((button) =>
  button.addEventListener("click", () => {
    const view = button.getAttribute("data-view");
    if (view) {
      setSessionView(view);
    }
  })
);
captureSnapshotButton?.addEventListener("click", () => {
  const selection = getSelectedSession();
  if (selection && selection.source === "active") {
    captureSnapshotForSession(selection.session.id);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeSessionModal();
  }
});

function openSessionModal() {
  if (!sessionModal) return;
  sessionModal.hidden = false;
  sessionModalForm?.reset();
  headlessInput.checked = false;
  slowMoInput.value = "100";
  updateSlowMoLabel();
  createSessionFeedback?.setAttribute("hidden", "true");
  createSessionFeedbackPre.textContent = "";
  slowMoInput?.focus();
}

function closeSessionModal() {
  if (!sessionModal) return;
  sessionModal.hidden = true;
}

function updateSlowMoLabel() {
  if (!slowMoInput || !slowMoValueLabel) return;
  slowMoValueLabel.textContent = `${slowMoInput.value} ms`;
}

async function handleCreateSessionSubmit(event) {
  event.preventDefault();
  if (!sessionModalForm) return;

  const config = {};

  if (headlessInput) {
    config.headless = headlessInput.checked;
  }

  if (slowMoInput) {
    const slowMo = Number(slowMoInput.value);
    if (!Number.isNaN(slowMo) && slowMo > 0) {
      config.slowMo = slowMo;
    }
  }

  const width = Number(viewportWidthInput?.value);
  const height = Number(viewportHeightInput?.value);
  if (!Number.isNaN(width) && width > 0 && !Number.isNaN(height) && height > 0) {
    config.viewport = { width, height };
  }

  const payload = Object.keys(config).length ? { config } : {};

  showCreateSessionFeedback("Session wird erstellt...", false);

  try {
    const response = await fetch("/browser/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    showCreateSessionFeedback(data, !response.ok);

    if (response.ok) {
      closeSessionModal();
      await loadSessions(false);
    }
  } catch (error) {
    showCreateSessionFeedback({ error: error.message }, true);
  }
}

function showCreateSessionFeedback(message, isError = false) {
  if (!createSessionFeedback || !createSessionFeedbackPre) return;
  createSessionFeedback.hidden = false;
  createSessionFeedbackPre.textContent =
    typeof message === "string" ? message : JSON.stringify(message, null, 2);
  createSessionFeedback.dataset.state = isError ? "error" : "success";
}

function getSessionsForView(view) {
  return view === "history" ? historySessions : activeSessions;
}

function renderSessionList() {
  if (!sessionListContainer) {
    return;
  }

  const sessions = getSessionsForView(sessionView);
  sessionListContainer.innerHTML = "";

  if (!sessions.length) {
    const placeholder = document.createElement("div");
    placeholder.className = "placeholder";
    placeholder.textContent =
      sessionView === "history"
        ? "Noch keine gespeicherten Sessions."
        : "Noch keine aktiven Sessions. Starte eine neue oder aktualisiere.";
    sessionListContainer.appendChild(placeholder);
    if (sessionView === selectedSessionSource) {
      selectedSessionId = null;
      renderActionPanel();
      renderPreviewForSelection();
    }
    updateSnapshotButtonState();
    return;
  }

  sessions.forEach((session) => {
    const card = document.createElement("article");
    card.className = "session-card";
    card.dataset.sessionId = session.id;

    const isSelected =
      session.id === selectedSessionId && sessionView === selectedSessionSource;
    if (isSelected) {
      card.classList.add("active");
    }

    const header = document.createElement("div");
    header.className = "session-card__header";

    const title = document.createElement("h3");
    title.className = "session-card__id";
    title.textContent = session.id;
    header.appendChild(title);

    const statusChip = document.createElement("span");
    statusChip.className = "status-chip";
    statusChip.dataset.status = session.status;
    statusChip.textContent = session.status ?? "unbekannt";
    header.appendChild(statusChip);
    card.appendChild(header);

    const meta = document.createElement("div");
    meta.className = "session-card__meta";

    meta.appendChild(createMetaRow("URL", session.currentUrl || "–"));
    meta.appendChild(
      createMetaRow(
        "Titel",
        session.title || "–"
      )
    );
    meta.appendChild(
      createMetaRow(
        "Zuletzt aktiv",
        formatTimestamp(session.lastActivityAt)
      )
    );

    card.appendChild(meta);

    const footer = document.createElement("div");
    footer.className = "session-card__footer";

    const timing = document.createElement("span");
    timing.className = "session-card__time";
    timing.textContent = `Gestartet ${formatRelativeTime(session.createdAt)}`;
    footer.appendChild(timing);

    if (sessionView === "active") {
      const actions = document.createElement("div");
      actions.className = "session-card__actions";

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "danger small";
      deleteButton.textContent = "Beenden";
      deleteButton.addEventListener("click", (event) => {
        event.stopPropagation();
        terminateSession(session.id);
      });

      actions.appendChild(deleteButton);
      footer.appendChild(actions);
    } else {
      const actions = document.createElement("div");
      actions.className = "session-card__actions";

      const deleteHistoryButton = document.createElement("button");
      deleteHistoryButton.type = "button";
      deleteHistoryButton.className = "ghost small";
      deleteHistoryButton.textContent = "Aus Historie entfernen";
      deleteHistoryButton.addEventListener("click", (event) => {
        event.stopPropagation();
        deleteSessionFromHistory(session.id);
      });

      actions.appendChild(deleteHistoryButton);
      footer.appendChild(actions);
    }

    card.appendChild(footer);

    card.addEventListener("click", () => {
      selectSession(session.id, sessionView);
    });

    sessionListContainer.appendChild(card);
  });

  if (
    !selectedSessionId ||
    !getSessionsForView(selectedSessionSource).some(
      (session) => session.id === selectedSessionId
    )
  ) {
    const firstSession = sessions[0];
    if (firstSession) {
      selectSession(firstSession.id, sessionView, { silent: true });
    }
  } else {
    updateSessionCardSelection();
    renderActionPanel();
    renderPreviewForSelection();
  }

  updateSnapshotButtonState();
}

function updateSessionCardSelection() {
  const cards = sessionListContainer?.querySelectorAll(".session-card");
  if (!cards) return;
  cards.forEach((card) => {
    const id = card.dataset.sessionId;
    const view = sessionView;
    const isActive =
      id === selectedSessionId && view === selectedSessionSource;
    card.classList.toggle("active", Boolean(isActive));
  });
}

function selectSession(sessionId, source, options = {}) {
  selectedSessionId = sessionId;
  selectedSessionSource = source;
  updateSessionCardSelection();
  if (!options.silent) {
    renderActionPanel();
    renderPreviewForSelection();
  }
  updateSnapshotButtonState();
}

function getSelectedSession() {
  if (!selectedSessionId) return null;
  const list = getSessionsForView(selectedSessionSource);
  const session = list.find((item) => item.id === selectedSessionId);
  if (!session) return null;
  return { session, source: selectedSessionSource };
}

function createMetaRow(label, value) {
  const row = document.createElement("span");
  const strong = document.createElement("strong");
  strong.textContent = `${label}:`;
  row.appendChild(strong);

  if (typeof value === "string" && value.startsWith("http")) {
    const link = document.createElement("a");
    link.href = value;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = value;
    link.classList.add("muted");
    row.appendChild(link);
  } else {
    const text = document.createElement("span");
    text.className = "muted";
    text.textContent = value;
    row.appendChild(text);
  }

  return row;
}

function formatTimestamp(value) {
  if (!value) return "–";
  const date = new Date(value);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

function formatRelativeTime(value) {
  if (!value) return "–";
  const date = new Date(value);
  const delta = Date.now() - date.getTime();
  const minutes = Math.round(delta / 60000);
  if (minutes < 1) return "gerade eben";
  if (minutes === 1) return "vor 1 Minute";
  if (minutes < 60) return `vor ${minutes} Minuten`;
  const hours = Math.round(minutes / 60);
  if (hours === 1) return "vor 1 Stunde";
  if (hours < 24) return `vor ${hours} Stunden`;
  const days = Math.round(hours / 24);
  if (days === 1) return "vor 1 Tag";
  return `vor ${days} Tagen`;
}

function setSessionView(view) {
  if (view !== "active" && view !== "history") {
    return;
  }

  if (sessionView === view) {
    return;
  }

  sessionView = view;
  sessionViewButtons.forEach((button) => {
    const isActive = button.getAttribute("data-view") === view;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  const sessions = getSessionsForView(view);
  if (!sessions.some((session) => session.id === selectedSessionId && selectedSessionSource === view)) {
    if (sessions.length) {
      selectedSessionId = sessions[0].id;
      selectedSessionSource = view;
    } else {
      selectedSessionId = null;
      selectedSessionSource = view;
    }
  } else {
    selectedSessionSource = view;
  }

  renderSessionList();
  renderActionPanel();
  renderPreviewForSelection();
  updateSnapshotButtonState();
}

function renderPreviewForSelection() {
  if (!previewContent) return;

  updateSnapshotButtonState();

  const selection = getSelectedSession();
  if (!selection) {
    renderPreviewPlaceholder("Wähle eine Session aus, um die Seiten-Skizze zu sehen.");
    return;
  }

  const session = selection.session;
  if (!session.currentUrl) {
    renderPreviewPlaceholder("Für diese Session liegt noch keine URL vor.");
    return;
  }

  const requestId = ++lastPreviewRequestId;
  renderPreviewLoading("Lade gespeicherte Elemente...");

  fetch(`/websites/resolve?url=${encodeURIComponent(session.currentUrl)}&limit=60`)
    .then(async (response) => {
      if (requestId !== lastPreviewRequestId) return null;
      if (response.status === 404) {
        return { status: 404 };
      }
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Konnte Website nicht laden");
      }
      return { status: response.status, data: data.data };
    })
    .then((result) => {
      if (!result || requestId !== lastPreviewRequestId) return;
      if (result.status === 404) {
        renderPreviewPlaceholder(
          "Noch kein Snapshot gespeichert. Erstelle einen neuen Snapshot, um Elemente zu sehen.",
          selection.source === "active"
        );
        return;
      }
      renderWebsitePreview(result.data, session);
    })
    .catch((error) => {
      if (requestId !== lastPreviewRequestId) return;
      renderPreviewPlaceholder(`Fehler beim Laden der Seiten-Skizze: ${error.message}`);
    });
}

function renderPreviewPlaceholder(message, showSnapshotAction = false) {
  if (!previewContent) return;
  previewContent.className = "preview-placeholder";
  previewContent.textContent = "";
  const paragraph = document.createElement("p");
  paragraph.textContent = message;
  previewContent.appendChild(paragraph);

  if (captureSnapshotButton) {
    captureSnapshotButton.hidden = !showSnapshotAction;
    captureSnapshotButton.disabled = !showSnapshotAction;
  }
}

function renderPreviewLoading(message) {
  if (!previewContent) return;
  previewContent.className = "preview-placeholder";
  previewContent.textContent = "";
  const paragraph = document.createElement("p");
  paragraph.textContent = message;
  previewContent.appendChild(paragraph);
}

function renderWebsitePreview(payload, session) {
  if (!previewContent) return;
  previewContent.className = "preview-content";
  previewContent.innerHTML = "";

  const website = payload?.website;
  const elements = payload?.elements || [];

  const header = document.createElement("div");
  header.className = "preview-header";

  const title = document.createElement("h3");
  title.textContent =
    website?.title ||
    session?.title ||
    session?.currentUrl ||
    "Unbenannte Seite";
  header.appendChild(title);

  const url = document.createElement("div");
  url.className = "preview-url";
  url.textContent = website?.url || session?.currentUrl || "–";
  header.appendChild(url);

  const meta = document.createElement("div");
  meta.className = "preview-meta";
  if (website?.domain) {
    meta.appendChild(createMetaBadge("Domain", website.domain));
  }
  meta.appendChild(createMetaBadge("Interaktive Elemente", String(website?.elementCount ?? elements.length)));
  meta.appendChild(createMetaBadge("Zuletzt gescannt", formatTimestamp(website?.lastScannedAt)));
  header.appendChild(meta);

  previewContent.appendChild(header);

  if (elements.length === 0) {
    const empty = document.createElement("div");
    empty.className = "preview-placeholder";
    const paragraph = document.createElement("p");
    paragraph.textContent = "Keine interaktiven Elemente gespeichert.";
    empty.appendChild(paragraph);
    previewContent.appendChild(empty);
    return;
  }

  const galleryTitle = document.createElement("h4");
  galleryTitle.textContent = "Interaktive Elemente";
  previewContent.appendChild(galleryTitle);

  const gallery = document.createElement("div");
  gallery.className = "element-gallery";
  elements.slice(0, 24).forEach((element) => {
    gallery.appendChild(createElementChip(element));
  });

  previewContent.appendChild(gallery);
  updateSnapshotButtonState();
}

function createMetaBadge(label, value) {
  const badge = document.createElement("span");
  badge.textContent = `${label}: ${value}`;
  return badge;
}

function createElementChip(element) {
  const chip = document.createElement("article");
  chip.className = "element-chip";

  const header = document.createElement("div");
  header.className = "element-chip__header";

  const tag = document.createElement("span");
  tag.className = "element-chip__tag";
  tag.textContent = element.tagName?.toUpperCase?.() || element.tag?.toUpperCase?.() || "ELEMENT";
  header.appendChild(tag);

  const text = document.createElement("p");
  text.className = "element-chip__text";
  text.textContent = element.textContent?.trim() || element.text?.trim() || "(kein Text)";
  header.appendChild(text);

  chip.appendChild(header);

  const meta = document.createElement("div");
  meta.className = "element-chip__meta";
  [
    ["Selector", element.cssSelector || element.selector || "–"],
    ["Rolle", element.role || "–"],
    ["Aktion", element.href || element.formAction || "–"],
  ].forEach(([label, value]) => {
    const row = document.createElement("span");
    row.textContent = `${label}: ${value}`;
    meta.appendChild(row);
  });
  chip.appendChild(meta);

  const actions = document.createElement("div");
  actions.className = "element-chip__actions";

  const copySelector = document.createElement("button");
  copySelector.type = "button";
  copySelector.className = "secondary small";
  copySelector.textContent = "Selector kopieren";
  copySelector.addEventListener("click", (event) => {
    event.stopPropagation();
    copyToClipboard(element.cssSelector || element.selector || "");
    copySelector.textContent = "Kopiert";
    copySelector.disabled = true;
    setTimeout(() => {
      copySelector.textContent = "Selector kopieren";
      copySelector.disabled = false;
    }, 1500);
  });
  actions.appendChild(copySelector);

  if (element.href) {
    const openLink = document.createElement("button");
    openLink.type = "button";
    openLink.className = "secondary small";
    openLink.textContent = "Link öffnen";
    openLink.addEventListener("click", (event) => {
      event.stopPropagation();
      window.open(element.href, "_blank", "noopener");
    });
    actions.appendChild(openLink);
  }

  chip.appendChild(actions);
  return chip;
}

function copyToClipboard(text) {
  if (!text) return;
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    });
  }
}

function updateSnapshotButtonState() {
  if (!captureSnapshotButton) return;
  const selection = getSelectedSession();
  const canCapture =
    selection && selection.source === "active" && Boolean(selection.session?.currentUrl);
  captureSnapshotButton.hidden = !canCapture;
  captureSnapshotButton.disabled = !canCapture;
}

async function captureSnapshotForSession(sessionId) {
  if (!sessionId) return;
  renderPreviewLoading("Snapshot wird erstellt...");
  const requestId = ++lastPreviewRequestId;
  if (captureSnapshotButton) {
    captureSnapshotButton.disabled = true;
  }

  try {
    const response = await fetch(`/websites/sessions/${sessionId}/snapshot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 60 }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || "Snapshot fehlgeschlagen");
    }

    if (requestId === lastPreviewRequestId) {
      const selection = getSelectedSession();
      const session =
        selection && selection.session.id === sessionId
          ? selection.session
          : { id: sessionId, currentUrl: data.data?.website?.url };
      renderWebsitePreview(data.data, session);
      await loadSessions(true);
      updateSnapshotButtonState();
    }
  } catch (error) {
    if (requestId === lastPreviewRequestId) {
      renderPreviewPlaceholder(`Snapshot fehlgeschlagen: ${error.message}`, true);
    }
  } finally {
    updateSnapshotButtonState();
  }
}

async function terminateSession(sessionId) {
  if (!sessionId) return;
  try {
    const response = await fetch(`/browser/session/${sessionId}`, {
      method: "DELETE",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error || "Session konnte nicht beendet werden");
    }
    await loadSessions(false);
  } catch (error) {
    renderPreviewPlaceholder(`Fehler beim Beenden der Session: ${error.message}`);
  }
}

function updateSessionCounters() {
  badgeActive && (badgeActive.textContent = String(activeSessions.length));
  badgeHistory && (badgeHistory.textContent = String(historySessions.length));
  statActive && (statActive.textContent = String(activeSessions.length));
  statHistory && (statHistory.textContent = String(historySessions.length));

  const combined = [...activeSessions, ...historySessions];
  const latest = combined
    .map((session) => session.lastActivityAt || session.updatedAt || session.createdAt)
    .filter(Boolean)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

  if (statLastActivity) {
    statLastActivity.textContent = latest ? formatRelativeTime(latest) : "–";
  }
}

function renderActionPanel() {
  const selection = getSelectedSession();

  if (!selection) {
    actionTitle.textContent = "Aktionen";
    actionPanel.classList.add("placeholder");
    actionPanel.textContent =
      "Wähle links eine Session aus, um Aktionen auszuführen.";
    return;
  }

  if (selection.source !== "active") {
    actionTitle.textContent = `Aktionen`;
    actionPanel.classList.add("placeholder");
    actionPanel.textContent =
      "Aktionen stehen nur für aktive Sessions zur Verfügung.";
    return;
  }

  const session = selection.session;
  actionTitle.textContent = `Aktionen für ${session.id}`;
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
    const block = createActionBlock(action, session.id);
    actionGrid.appendChild(block);
  });

  tabContent.appendChild(actionGrid);
  actionPanel.appendChild(tabContent);
}

function createSessionOverview(session) {
  const container = document.createElement("div");
  container.className = "action-block session-overview";

  if (!session) {
    const info = document.createElement("p");
    info.className = "muted";
    info.textContent = "Keine Session-Daten verfügbar.";
    container.appendChild(info);
    return container;
  }

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
  const previousSelection = preserveSelection ? getSelectedSession() : null;

  try {
    const [activeResponse, historyResponse] = await Promise.all([
      fetch("/browser/sessions"),
      fetch("/browser/sessions/history?limit=60"),
    ]);

    const activeData = await activeResponse.json();
    const historyData = await historyResponse.json();

    if (!activeResponse.ok) {
      throw new Error(activeData?.error || "Konnte aktive Sessions nicht laden");
    }
    if (!historyResponse.ok) {
      throw new Error(historyData?.error || "Konnte Session-Historie nicht laden");
    }

    activeSessions = activeData.data || [];
    historySessions = historyData.data || [];
    updateSessionCounters();

    if (previousSelection) {
      const { session, source } = previousSelection;
      const stillExists = getSessionsForView(source).some((s) => s.id === session.id);
      if (stillExists) {
        selectedSessionId = session.id;
        selectedSessionSource = source;
      } else {
        selectedSessionId = null;
        selectedSessionSource = sessionView;
      }
    } else {
    selectedSessionId = null;
    selectedSessionSource = sessionView;
  }

    sessionViewButtons.forEach((button) => {
      const isActive = button.getAttribute("data-view") === sessionView;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    renderSessionList();
    renderActionPanel();
    renderPreviewForSelection();
    updateSnapshotButtonState();
  } catch (error) {
    activeSessions = [];
    historySessions = [];
    updateSessionCounters();

    if (sessionListContainer) {
      sessionListContainer.innerHTML = "";
      const placeholder = document.createElement("div");
      placeholder.className = "placeholder";
      placeholder.textContent = "Fehler beim Laden der Sessions: " + error.message;
      sessionListContainer.appendChild(placeholder);
    }

    selectedSessionId = null;
    renderActionPanel();
    renderPreviewPlaceholder("Keine Daten verfügbar.");
    updateSnapshotButtonState();
  }
}

loadSessions(false);
