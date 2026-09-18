const modal = document.getElementById("issue-modal");
const toast = document.getElementById("toast");
const pageTitle = document.getElementById("page-title");
const breadcrumb = document.getElementById("breadcrumb-current");
const authGate = document.getElementById("auth-gate");
const authError = document.getElementById("auth-error");
const formError = document.getElementById("form-error");
const overviewGrid = document.getElementById("overview-grid");
const viewPanel = document.getElementById("view-panel");
const userProfileModal = document.getElementById("user-profile-modal");
const darkModeStorageKey = "keystone-dark-mode";
const paletteStorageKey = "keystone-palette";
const palettes = ["meadow", "ocean", "clay", "citrus"];
let appProfiles = [];
let customerRecords = [];
let focusedLicenseId = null;
let notificationsPanel = null;
let focusedCustomerId = null;

document.querySelectorAll(".metric-card").forEach((card) => {
  if (card.textContent.includes("MONTHLY REVENUE")) card.remove();
});
const dashboardProfileLink = document.querySelector(
  ".profile-panel .manage-button",
);
if (dashboardProfileLink)
  dashboardProfileLink.innerHTML = "View profiles <span>→</span>";

function setDarkMode(enabled) {
  document.body.classList.toggle("dark-mode", enabled);
  localStorage.setItem(darkModeStorageKey, String(enabled));
}

function setPalette(palette) {
  const selectedPalette = palettes.includes(palette) ? palette : "meadow";
  document.body.classList.remove(...palettes.map((name) => `palette-${name}`));
  document.body.classList.add(`palette-${selectedPalette}`);
  localStorage.setItem(paletteStorageKey, selectedPalette);
}

const savedDarkMode = localStorage.getItem(darkModeStorageKey);
const defaultDarkMode =
  savedDarkMode === null ? true : savedDarkMode === "true";
setDarkMode(defaultDarkMode);
setPalette(localStorage.getItem(paletteStorageKey) || "meadow");

function updateLicenseOptions(appId) {
  const optionSelect = document.getElementById("plan");
  if (!optionSelect) return;
  const profile = appProfiles.find((candidate) => candidate.app_id === appId);
  const options = profile
    ? profile.license_options || []
    : [
        {
          id: "trial-30",
          type: "trial",
          label: "30-day trial",
          length_days: 30,
        },
        { id: "pro-365", type: "pro", label: "Pro · 1 year", length_days: 365 },
      ];
  optionSelect.innerHTML = options
    .map(
      (option) =>
        `<option value="${escapeHtml(option.id)}">${escapeHtml(option.label || `${option.type} · ${option.length_days} days`)}</option>`,
    )
    .join("");
  optionSelect.disabled = options.length === 0;
  optionSelect.closest("label").firstChild.textContent = "License option";
  const typeLabel = document.getElementById("license-type")?.closest("label");
  if (typeLabel) typeLabel.hidden = true;
}

function updateApplicationOptions() {
  const applicationSelect = document.getElementById("application");
  if (!applicationSelect || !appProfiles.length) return;
  const currentAppId = applicationSelect.value;
  applicationSelect.innerHTML = appProfiles
    .map(
      (profile) =>
        `<option value="${escapeHtml(profile.app_id)}">${escapeHtml(profile.name)}</option>`,
    )
    .join("");
  applicationSelect.value = appProfiles.some(
    (profile) => profile.app_id === currentAppId,
  )
    ? currentAppId
    : appProfiles[0].app_id;
  updateLicenseOptions(applicationSelect.value);
}

async function loadAppProfiles() {
  try {
    appProfiles = (await api("/api/state")).profiles || [];
  } catch {
    appProfiles = [];
  }
  updateApplicationOptions();
}

function updateCustomerOptions() {
  const customerName = document.getElementById("customer");
  const customerEmail = document.getElementById("email");
  if (!customerName || !customerEmail) return;
  let customerSelect = document.getElementById("customer-select");
  if (!customerSelect) {
    customerSelect = document.createElement("select");
    customerSelect.id = "customer-select";
    customerSelect.setAttribute("aria-label", "Customer");
    customerName.closest(".form-grid").before(
      Object.assign(document.createElement("label"), {
        className: "customer-select-field",
        innerHTML: 'Customer<select id="customer-select"></select>',
      }),
    );
    customerSelect = document.getElementById("customer-select");
    customerName.closest("label").dataset.newCustomerField = "true";
    customerEmail.closest("label").dataset.newCustomerField = "true";
    customerSelect.addEventListener("change", () => {
      const selected = customerRecords.find(
        (customer) => customer.id === customerSelect.value,
      );
      const isNew = customerSelect.value === "new";
      customerName.closest("label").hidden = !isNew;
      customerEmail.closest("label").hidden = !isNew;
      if (selected) {
        customerName.value = selected.name;
        customerEmail.value = selected.email;
      } else if (isNew) {
        customerName.value = "";
        customerEmail.value = "";
      }
    });
  }
  customerSelect.innerHTML =
    '<option value="new">＋ Add new customer</option>' +
    customerRecords
      .map(
        (customer) =>
          `<option value="${escapeHtml(customer.id)}">${escapeHtml(customer.name)} · ${escapeHtml(customer.email)}</option>`,
      )
      .join("");
  customerSelect.value = customerRecords.length ? customerRecords[0].id : "new";
  customerSelect.dispatchEvent(new Event("change"));
}

async function loadCustomers() {
  try {
    customerRecords = (await api("/api/state")).customers || [];
  } catch {
    customerRecords = [];
  }
  updateCustomerOptions();
}

const viewCopy = {
  licenses: {
    eyebrow: "LICENSE OPERATIONS",
    title: "Licenses",
    description:
      "Search, renew, revoke, and inspect every Home Assistant app license.",
    rows: [
      ["Harbor House", "HA Companion", "Pro", "Sep 18, 2026", "Expiring"],
      ["Summit Home", "HA Companion", "Trial", "Sep 22, 2026", "Trial"],
      ["Northstar Home", "HA Voice", "Pro", "Sep 29, 2026", "Expiring"],
      ["Silverleaf Home", "HA Companion", "Base", "Oct 04, 2026", "Active"],
    ],
  },
  customers: {
    eyebrow: "CUSTOMER DIRECTORY",
    title: "Customers",
    description: "Customer records connected to Home Assistant installations.",
    rows: [
      [
        "Harbor House",
        "admin@harborhouse.io",
        "2 installations",
        "3 licenses",
        "Active",
      ],
      [
        "Summit Home",
        "hello@summithome.co",
        "1 installation",
        "1 trial",
        "Trial",
      ],
      [
        "Northstar Home",
        "ops@northstarhome.io",
        "4 installations",
        "2 licenses",
        "Active",
      ],
    ],
  },
  activations: {
    eyebrow: "INSTALLATION CONTROL",
    title: "Activations",
    description: "Review instance identity, leases, and installation limits.",
    rows: [
      [
        "Harbor House",
        "HA Companion",
        "installation-01",
        "1 / 2 used",
        "Healthy",
      ],
      [
        "Northstar Home",
        "HA Voice",
        "installation-04",
        "2 / 3 used",
        "Renew soon",
      ],
      [
        "Silverleaf Home",
        "HA Companion",
        "installation-02",
        "1 / 2 used",
        "Healthy",
      ],
    ],
  },
  profiles: {
    eyebrow: "APPLICATION CONFIGURATION",
    title: "App profiles",
    description:
      "Plans, entitlements, audiences, and activation rules for each app.",
    rows: [
      [
        "HA Companion",
        "home-assistant-companion",
        "30 day trial",
        "2 installs",
        "Active",
      ],
      [
        "HA Voice",
        "home-assistant-voice",
        "30 day trial",
        "3 installs",
        "Active",
      ],
    ],
  },
  keys: {
    eyebrow: "SIGNING SECURITY",
    title: "Signing keys",
    description: "Ed25519 issuer keys and rotation readiness.",
    rows: [
      ["issuer-ed25519-01", "Ed25519", "Active", "Current", "Protected"],
      [
        "issuer-ed25519-00",
        "Ed25519",
        "Previous",
        "Rotation complete",
        "Protected",
      ],
    ],
  },
  audit: {
    eyebrow: "SECURITY HISTORY",
    title: "Audit log",
    description: "Administrative events recorded by the licensing issuer.",
    rows: [
      [
        "License issued",
        "HA Companion Pro",
        "Maple Street Home",
        "12 minutes ago",
        "Admin",
      ],
      [
        "Activation renewed",
        "HA Companion",
        "Silverleaf Home",
        "46 minutes ago",
        "System",
      ],
      [
        "License revoked",
        "HA Voice Base",
        "Juniper Home",
        "2 hours ago",
        "Admin",
      ],
    ],
  },
  settings: {
    eyebrow: "WORKSPACE PREFERENCES",
    title: "Configuration",
    description: "Adjust the portal experience and issuer defaults.",
    rows: [],
  },
};

function escapeHtml(value) {
  return String(value).replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        character
      ],
  );
}

async function showView(view) {
  const selectedView = viewCopy[view];
  overviewGrid.hidden = Boolean(selectedView);
  viewPanel.hidden = !selectedView;
  if (!selectedView) return;
  if (view === "settings") {
    viewPanel.innerHTML =
      '<div class="panel view-card settings-card"><div class="panel-heading"><div><p class="eyebrow">WORKSPACE PREFERENCES</p><h2>Configuration</h2><p>Adjust the portal experience and issuer defaults for this workspace.</p></div></div><div class="settings-list"><div class="setting-row"><div><strong>Dark mode</strong><p>Use a darker surface treatment for low-light operator sessions.</p></div><label class="toggle"><input type="checkbox" id="dark-mode-toggle"><span></span></label></div><div class="setting-row palette-row"><div><strong>Color palette</strong><p>Choose the accent and workspace tone for your operator console.</p></div><div class="palette-options" role="group" aria-label="Color palette"><button type="button" class="palette-choice" data-palette="meadow" aria-label="Meadow palette"><i></i><span>Meadow</span></button><button type="button" class="palette-choice" data-palette="ocean" aria-label="Ocean palette"><i></i><span>Ocean</span></button><button type="button" class="palette-choice" data-palette="clay" aria-label="Clay palette"><i></i><span>Clay</span></button><button type="button" class="palette-choice" data-palette="citrus" aria-label="Citrus palette"><i></i><span>Citrus</span></button></div></div><div class="setting-row"><div><strong>Issuer status</strong><p>Ed25519 signing vault and local persistence are active.</p></div><span class="setting-status"><i class="status-dot"></i> Protected</span></div><div class="setting-row"><div><strong>Workspace</strong><p>Multi-application licensing · local issuer mode</p></div><span class="setting-value">Keystone</span></div></div></div>';
    const darkModeToggle = document.getElementById("dark-mode-toggle");
    darkModeToggle.checked = document.body.classList.contains("dark-mode");
    const keyRow = document.createElement("div");
    keyRow.className = "setting-row issuer-key-row";
    keyRow.innerHTML =
      '<div class="issuer-key-copy"><strong>Issuer public key</strong><p>Copy this public key into licensed applications for local Ed25519 verification.</p><pre id="issuer-public-key">Loading public key...</pre></div><button type="button" class="secondary-button" id="copy-issuer-key">Copy key</button>';
    document.querySelector(".settings-list").appendChild(keyRow);
    try {
      const issuer = await api("/api/issuer/public-key");
      const keyElement = document.getElementById("issuer-public-key");
      keyElement.textContent = issuer.public_key_pem;
      document
        .getElementById("copy-issuer-key")
        .addEventListener("click", async () => {
          await navigator.clipboard.writeText(issuer.public_key_pem);
          document.getElementById("copy-issuer-key").textContent = "Copied";
          window.setTimeout(() => {
            document.getElementById("copy-issuer-key").textContent = "Copy key";
          }, 1800);
        });
    } catch (error) {
      document.getElementById("issuer-public-key").textContent =
        `Unable to load public key: ${error.message}`;
    }
    darkModeToggle.addEventListener("change", () =>
      setDarkMode(darkModeToggle.checked),
    );
    document.querySelectorAll("[data-palette]").forEach((button) => {
      button.classList.toggle(
        "selected",
        button.dataset.palette ===
          (localStorage.getItem(paletteStorageKey) || "meadow"),
      );
      button.addEventListener("click", () => {
        setPalette(button.dataset.palette);
        document
          .querySelectorAll("[data-palette]")
          .forEach((choice) =>
            choice.classList.toggle("selected", choice === button),
          );
      });
    });
    return;
  }
  let rows = selectedView.rows;
  let profileRecords = [];
  let customerRecords = [];
  let licenseRecords = [];
  if (view === "profiles") {
    try {
      const state = await api("/api/state");
      profileRecords = state.profiles;
      rows = profileRecords.map((profile) => [
        profile.name,
        profile.app_id,
        (profile.license_options || [])
          .map(
            (option) =>
              option.label || `${option.type} · ${option.length_days} days`,
          )
          .join(" · "),
        `${profile.installation_limit} installs`,
        "Active",
      ]);
    } catch {
      profileRecords = rows.map((row) => ({ app_id: row[1], name: row[0] }));
    }
  }
  if (view === "customers") {
    try {
      const state = await api("/api/state");
      customerRecords = state.customers || [];
      rows = customerRecords.map((customer) => {
        const activeLicenses = state.licenses.filter(
          (license) =>
            license.customer_id === customer.id && license.status !== "revoked",
        ).length;
        return [
          customer.name,
          customer.email,
          `${activeLicenses} active license${activeLicenses === 1 ? "" : "s"}`,
          activeLicenses ? "Active" : "No active licenses",
          activeLicenses ? "Protected" : "Eligible",
        ];
      });
    } catch {
      customerRecords = [];
    }
  }
  if (view === "licenses") {
    try {
      const state = await api("/api/state");
      licenseRecords = state.licenses || [];
      const customersById = Object.fromEntries(
        (state.customers || []).map((customer) => [customer.id, customer.name]),
      );
      const profilesById = Object.fromEntries(
        (state.profiles || []).map((profile) => [profile.app_id, profile.name]),
      );
      licenseRecords = focusedCustomerId
        ? licenseRecords.filter(
            (license) =>
              license.customer_id === focusedCustomerId &&
              license.status !== "revoked" &&
              Date.parse(license.expires_at) > Date.now(),
          )
        : licenseRecords;
      rows = licenseRecords.map((license) => [
        customersById[license.customer_id] || license.customer_id,
        profilesById[license.app_id] || license.app_id,
        license.plan,
        new Date(license.expires_at).toLocaleDateString("en-US", {
          month: "short",
          day: "2-digit",
          year: "numeric",
        }),
        license.status,
      ]);
    } catch {
      licenseRecords = [];
    }
  }
  const rowsMarkup =
    view === "profiles"
      ? rows
          .map(
            (row, index) =>
              `<div class="view-row profile-view-row"><span>${escapeHtml(row[0])}</span><span>${escapeHtml(row[1])}</span><span>${escapeHtml(row[2])}</span><span class="row-state">${escapeHtml(row[4])}</span><button class="edit-profile" data-profile-edit="${escapeHtml(profileRecords[index]?.app_id || row[1])}" type="button">Edit</button><button class="delete-profile" data-profile-delete="${escapeHtml(profileRecords[index]?.app_id || row[1])}" type="button">Delete</button></div>`,
          )
          .join("")
      : view === "customers"
        ? rows
            .map(
              (row, index) =>
                `<div class="view-row customer-view-row" data-customer-focus="${escapeHtml(customerRecords[index]?.id || "")}" tabindex="0"><span>${escapeHtml(row[0])}</span><span>${escapeHtml(row[1])}</span><span>${escapeHtml(row[2])}</span><span class="row-state">${escapeHtml(row[3])}</span>${row[4] === "Eligible" ? `<button class="delete-customer" data-customer-delete="${escapeHtml(customerRecords[index]?.id || "")}" type="button">Delete</button>` : '<span class="row-protected">Protected</span>'}</div>`,
            )
            .join("")
        : view === "licenses"
          ? rows
              .map(
                (row, index) =>
                  `<div class="view-row license-view-row ${focusedLicenseId === licenseRecords[index]?.license_id ? "focused-license-row" : ""}" data-license-row="${escapeHtml(licenseRecords[index]?.license_id || "")}"><span>${escapeHtml(row[0])}</span><span>${escapeHtml(row[1])}</span><span>${escapeHtml(row[2])}</span><span class="row-state ${row[4] === "revoked" ? "revoked-state" : ""}">${escapeHtml(row[4])}</span>${row[4] === "revoked" ? '<span class="row-protected">Historical</span>' : `<button class="deliver-license" data-license-deliver="${escapeHtml(licenseRecords[index]?.license_id || "")}" type="button">Deliver</button><button class="revoke-license" data-license-revoke="${escapeHtml(licenseRecords[index]?.license_id || "")}" type="button">Revoke</button>`}</div>`,
              )
              .join("")
          : rows
              .map(
                (row) =>
                  `<div class="view-row">${row.map((cell, index) => `<span class="${index === row.length - 1 ? "row-state" : ""}">${escapeHtml(cell)}</span>`).join("")}</div>`,
              )
              .join("");
  const actionMarkup =
    view === "profiles"
      ? '<button class="primary-button" id="view-action"><span>＋</span> Add profile</button>'
      : view === "customers"
        ? '<button class="primary-button" id="view-action"><span>＋</span> Add customer</button>'
        : "";
  viewPanel.innerHTML = `<div class="panel view-card"><div class="panel-heading"><div><p class="eyebrow">${selectedView.eyebrow}</p><h2>${selectedView.title}</h2><p>${selectedView.description}</p></div>${actionMarkup}</div><div class="view-table"><div class="view-row view-header"><span>${view === "licenses" || view === "customers" || view === "activations" ? "Customer" : "Resource"}</span><span>${view === "licenses" ? "Application" : "Details"}</span><span>${view === "licenses" ? "Plan" : "Reference"}</span><span>${view === "licenses" ? "Expires" : "Status"}</span><span></span></div>${rowsMarkup}</div></div>`;
  if (view === "licenses") focusedLicenseId = null;
}

async function api(path, options = {}) {
  const url = new URL(path.replace(/^\//, ""), document.baseURI);
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Request failed");
  return body;
}

async function establishSession() {
  const session = await api("/api/auth/session");
  authGate.hidden = session.authenticated;
  if (session.profile) updateUserProfile(session.profile);
  if (session.authenticated) await loadDashboardMetrics();
}

function updateUserProfile(profile) {
  document.getElementById("user-display-name").textContent = profile.name;
  document.getElementById("user-avatar").textContent = profile.name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  document.getElementById("user-profile-name").value = profile.name;
  document.getElementById("user-profile-email").value = profile.email;
  if (document.getElementById("breadcrumb-current").textContent === "Overview")
    pageTitle.innerHTML = `Good morning, ${escapeHtml(profile.name)}<span>.</span>`;
}

async function loadDashboardMetrics() {
  const state = await api("/api/state");
  const licenseBadge = document.querySelector(
    '.nav-item[data-view="licenses"] b',
  );
  if (licenseBadge)
    licenseBadge.textContent = String((state.licenses || []).length);
  updateAttentionTable(state);
  updateRecentActivity(state);
  updateDashboardProfiles(state.profiles || []);
  const metricCards = [...document.querySelectorAll(".metric-card")];
  const metrics = state.metrics || {};
  metricCards.forEach((card) => {
    const label = card.querySelector(".metric-top span")?.textContent.trim();
    const value = card.querySelector(":scope > strong");
    if (!value) return;
    if (label === "ACTIVE LICENSES")
      value.textContent = Number(metrics.active_licenses || 0).toLocaleString();
    if (label === "TRIALS IN PROGRESS")
      value.textContent = Number(
        metrics.trials_in_progress || 0,
      ).toLocaleString();
    if (label === "RENEWAL RATE")
      value.innerHTML = `${Number(metrics.renewal_rate || 0).toFixed(1)}<span class="unit">%</span>`;
  });
}

function updateDashboardProfiles(profiles) {
  const panel = document.querySelector(".profile-panel");
  if (!panel) return;
  const heading = panel.querySelector(".panel-heading p");
  if (heading)
    heading.textContent = `${profiles.length} active product${profiles.length === 1 ? "" : "s"}`;
  panel.querySelectorAll(".profile-item").forEach((item) => item.remove());
  const manageButton = panel.querySelector(".manage-button");
  profiles
    .slice(0, 4)
    .reverse()
    .forEach((profile) => {
      const item = document.createElement("div");
      item.className = "profile-item";
      item.innerHTML = `<div class="profile-logo bartender-logo">${escapeHtml(profile.name.slice(0, 2).toUpperCase())}</div><div class="profile-info"><strong>${escapeHtml(profile.name)}</strong><small>${(profile.license_options || []).length} license option${(profile.license_options || []).length === 1 ? "" : "s"}</small></div><span class="profile-arrow">→</span>`;
      panel.insertBefore(item, manageButton);
    });
}

function updateRecentActivity(state) {
  const activityList = document.querySelector(".activity-list");
  if (!activityList) return;
  const customersById = Object.fromEntries(
    (state.customers || []).map((customer) => [customer.id, customer.name]),
  );
  const profilesById = Object.fromEntries(
    (state.profiles || []).map((profile) => [profile.app_id, profile.name]),
  );
  const licensesById = Object.fromEntries(
    (state.licenses || []).map((license) => [license.license_id, license]),
  );
  const events = (state.audit_events || []).slice(0, 3);
  if (!events.length) {
    activityList.innerHTML =
      '<div class="activity-empty">No activity recorded yet.</div>';
    return;
  }
  const details = {
    "license.issued": { title: "License issued", icon: "✓", tone: "mint-bg" },
    "license.revoked": {
      title: "License revoked",
      icon: "×",
      tone: "coral-bg",
    },
    "license.renewed": { title: "License renewed", icon: "↻", tone: "blue-bg" },
    "customer.created": {
      title: "Customer created",
      icon: "+",
      tone: "mint-bg",
    },
    "customer.deleted": {
      title: "Customer deleted",
      icon: "×",
      tone: "coral-bg",
    },
    "app_profile.created": {
      title: "App profile created",
      icon: "+",
      tone: "mint-bg",
    },
    "app_profile.updated": {
      title: "App profile updated",
      icon: "↻",
      tone: "blue-bg",
    },
    "app_profile.deleted": {
      title: "App profile deleted",
      icon: "×",
      tone: "coral-bg",
    },
    "license_option.created": {
      title: "License option added",
      icon: "+",
      tone: "mint-bg",
    },
    "license_option.deleted": {
      title: "License option removed",
      icon: "×",
      tone: "coral-bg",
    },
  };
  activityList.innerHTML = events
    .map((event) => {
      const detail = details[event.action] || {
        title: event.action.replaceAll(".", " "),
        icon: "•",
        tone: "blue-bg",
      };
      const license = licensesById[event.license_id];
      const customerName =
        customersById[event.customer_id] ||
        (license && customersById[license.customer_id]);
      const profileName = profilesById[license?.app_id] || license?.app_id;
      const subject =
        customerName ||
        profileName ||
        event.app_id ||
        event.app_profile_id ||
        "Workspace";
      const context = license
        ? `${profileName || "License"} · ${customerName || "Customer"}`
        : `Actor: ${event.actor || "system"}`;
      const when = new Date(event.created_at).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
      return `<div class="activity-item"><div class="activity-icon ${detail.tone}">${detail.icon}</div><div><strong>${escapeHtml(detail.title)}</strong><p>${escapeHtml(subject)} <span>·</span> ${escapeHtml(context)}</p><small>${escapeHtml(when)}</small></div></div>`;
    })
    .join("");
}

function notificationText(event) {
  const labels = {
    "license.issued": "License issued",
    "license.revoked": "License revoked",
    "license.renewed": "License renewed",
    "customer.created": "Customer created",
    "customer.deleted": "Customer deleted",
    "app_profile.created": "App profile created",
    "app_profile.updated": "App profile updated",
    "app_profile.deleted": "App profile deleted",
    "license_option.created": "License option added",
    "license_option.deleted": "License option removed",
    "admin.profile.updated": "Administrator profile updated",
  };
  return labels[event.action] || event.action.replaceAll(".", " ");
}

function renderNotifications(state) {
  if (!notificationsPanel) {
    notificationsPanel = document.createElement("div");
    notificationsPanel.id = "notifications-panel";
    notificationsPanel.className = "notifications-panel";
    document.querySelector(".topbar-actions").appendChild(notificationsPanel);
  }
  const events = (state.audit_events || []).slice(0, 8);
  notificationsPanel.innerHTML = `<div class="notifications-header"><strong>Notifications</strong><button type="button" id="close-notifications" aria-label="Close notifications">×</button></div>${events.length ? `<div class="notifications-list">${events.map((event) => `<div class="notification-item"><span class="notification-dot"></span><div><strong>${escapeHtml(notificationText(event))}</strong><small>${escapeHtml(new Date(event.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }))}</small></div></div>`).join("")}</div>` : '<div class="notifications-empty">No new notifications.</div>'}`;
  notificationsPanel
    .querySelector("#close-notifications")
    .addEventListener("click", closeNotifications);
}

function closeNotifications() {
  if (notificationsPanel) notificationsPanel.hidden = true;
  document
    .getElementById("notifications-button")
    .setAttribute("aria-expanded", "false");
}

async function toggleNotifications() {
  const button = document.getElementById("notifications-button");
  if (notificationsPanel && !notificationsPanel.hidden)
    return closeNotifications();
  try {
    const state = await api("/api/state");
    renderNotifications(state);
    notificationsPanel.hidden = false;
    button.setAttribute("aria-expanded", "true");
  } catch (error) {
    button.title = error.message;
  }
}

document
  .getElementById("notifications-button")
  .addEventListener("click", toggleNotifications);
document.addEventListener("click", (event) => {
  if (
    notificationsPanel &&
    !notificationsPanel.hidden &&
    !event.target.closest("#notifications-panel, #notifications-button")
  )
    closeNotifications();
});

function updateAttentionTable(state) {
  const table = document.getElementById("license-table");
  if (!table) return;
  const customersById = Object.fromEntries(
    (state.customers || []).map((customer) => [customer.id, customer]),
  );
  const profilesById = Object.fromEntries(
    (state.profiles || []).map((profile) => [profile.app_id, profile]),
  );
  const now = Date.now();
  const attention = (state.licenses || [])
    .filter((license) => {
      const expiresAt = Date.parse(license.expires_at);
      return (
        license.status !== "revoked" &&
        expiresAt > now &&
        (license.license_type === "trial" ||
          license.option_type === "trial" ||
          expiresAt - now <= 30 * 86400000)
      );
    })
    .sort(
      (left, right) =>
        Date.parse(left.expires_at) - Date.parse(right.expires_at),
    )
    .slice(0, 4);
  const allTab = document.querySelector(".tabs .tab:nth-child(1) b");
  const expiringTab = document.querySelector(".tabs .tab:nth-child(2) b");
  const trialTab = document.querySelector(".tabs .tab:nth-child(3) b");
  const liveLicenses = (state.licenses || []).filter(
    (license) =>
      license.status !== "revoked" && Date.parse(license.expires_at) > now,
  );
  if (allTab) allTab.textContent = String((state.licenses || []).length);
  if (expiringTab)
    expiringTab.textContent = String(
      liveLicenses.filter(
        (license) =>
          Date.parse(license.expires_at) - now <= 30 * 86400000 &&
          license.license_type !== "trial" &&
          license.option_type !== "trial",
      ).length,
    );
  if (trialTab)
    trialTab.textContent = String(
      liveLicenses.filter(
        (license) =>
          license.license_type === "trial" || license.option_type === "trial",
      ).length,
    );
  if (!attention.length) {
    table.innerHTML =
      '<tr><td colspan="6" class="empty-table-state">No active licenses need attention.</td></tr>';
    return;
  }
  table.innerHTML = attention
    .map((license) => {
      const customer = customersById[license.customer_id];
      const profile = profilesById[license.app_id];
      const days = Math.max(
        1,
        Math.ceil((Date.parse(license.expires_at) - now) / 86400000),
      );
      const isTrial =
        license.license_type === "trial" || license.option_type === "trial";
      const date = new Date(license.expires_at).toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      });
      return `<tr class="attention-license-row" data-license-focus="${escapeHtml(license.license_id)}" tabindex="0"><td><div class="customer-cell"><div class="customer-avatar amber">${escapeHtml((customer?.name || "??").slice(0, 2).toUpperCase())}</div><div><strong>${escapeHtml(customer?.name || license.customer_id)}</strong><small>${escapeHtml(customer?.email || "")}</small></div></div></td><td><span class="app-name"><i class="app-dot bartender"></i>${escapeHtml(profile?.name || license.app_id)}</span></td><td><span class="plan ${isTrial ? "trial" : "pro"}">${escapeHtml((license.option_type || license.plan || "license").toUpperCase())}</span></td><td><strong>${date}</strong><small class="muted">in ${days} day${days === 1 ? "" : "s"}</small></td><td><span class="status-pill ${isTrial ? "trial-status" : "warning"}"><i></i>${isTrial ? "Trial" : "Expiring"}</span></td><td><button class="row-menu" aria-label="More actions">•••</button></td></tr>`;
    })
    .join("");
}

document
  .getElementById("login-form")
  .addEventListener("submit", async (event) => {
    event.preventDefault();
    authError.hidden = true;
    try {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: document.getElementById("login-email").value,
          password: document.getElementById("login-password").value,
        }),
      });
      authGate.hidden = true;
      const session = await api("/api/auth/session");
      if (session.profile) updateUserProfile(session.profile);
      await loadDashboardMetrics();
    } catch (error) {
      authError.textContent = error.message;
      authError.hidden = false;
    }
  });

async function openModal() {
  modal.hidden = false;
  await loadAppProfiles();
  updateApplicationOptions();
  await loadCustomers();
  document.getElementById("customer").focus();
}

function closeModal() {
  modal.hidden = true;
}

document.getElementById("open-issue").addEventListener("click", openModal);
document.getElementById("close-modal").addEventListener("click", closeModal);
document.getElementById("cancel-modal").addEventListener("click", closeModal);
document
  .getElementById("application")
  .addEventListener("change", (event) =>
    updateLicenseOptions(event.target.value),
  );
loadAppProfiles();
modal.addEventListener("click", (event) => {
  if (event.target === modal) closeModal();
});

document
  .getElementById("license-form")
  .addEventListener("submit", async (event) => {
    event.preventDefault();
    formError.hidden = true;
    try {
      const activationRequest = JSON.parse(
        document.getElementById("activation").value,
      );
      const result = await api("/api/licenses/issue", {
        method: "POST",
        body: JSON.stringify({
          app_id: document.getElementById("application").value,
          customer_id:
            document.getElementById("customer-select")?.value === "new"
              ? undefined
              : document.getElementById("customer-select")?.value,
          customer_name: document.getElementById("customer").value,
          customer_email: document.getElementById("email").value,
          option_id: document.getElementById("plan").value,
          instance_value: document.getElementById("instance").value,
          activation_request: activationRequest,
        }),
      });
      closeModal();
      showLicenseDelivery(result);
      event.target.reset();
      window.setTimeout(() => toast.classList.remove("show"), 4200);
    } catch (error) {
      formError.textContent = error.message.includes("JSON")
        ? "Activation request must be valid JSON."
        : error.message;
      formError.hidden = false;
    }
  });

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    const view = button.dataset.view;
    const label =
      view === "settings"
        ? "Configuration"
        : view.charAt(0).toUpperCase() + view.slice(1);
    document
      .querySelectorAll(".nav-item")
      .forEach((item) =>
        item.classList.toggle("active", item.dataset.view === view),
      );
    breadcrumb.textContent = label;
    if (view !== "overview") pageTitle.innerHTML = `${label}<span>.</span>`;
    else pageTitle.innerHTML = "Good morning, Casey<span>.</span>";
    showView(view);
  });
});

overviewGrid.addEventListener("click", (event) => {
  const row = event.target.closest("[data-license-focus]");
  if (!row) return;
  focusedLicenseId = row.dataset.licenseFocus;
  document.querySelector('.nav-item[data-view="licenses"]').click();
});
overviewGrid.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const row = event.target.closest("[data-license-focus]");
  if (!row) return;
  event.preventDefault();
  focusedLicenseId = row.dataset.licenseFocus;
  document.querySelector('.nav-item[data-view="licenses"]').click();
});

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document
      .querySelectorAll(".tab")
      .forEach((item) => item.classList.remove("active"));
    tab.classList.add("active");
  });
});

establishSession().catch(() => {
  if (window.location.protocol === "file:") {
    document.body.dataset.mode = "demo";
    authGate.hidden = true;
    return;
  }
  authError.textContent = "Start the portal server to sign in.";
  authError.hidden = false;
});

const customerModal = document.getElementById("customer-modal");
const customerFormError = document.getElementById("customer-form-error");
function closeCustomerModal() {
  customerModal.hidden = true;
}
function openCustomerModal() {
  customerModal.hidden = false;
  document.getElementById("customer-name").focus();
}
document
  .getElementById("close-customer-modal")
  .addEventListener("click", closeCustomerModal);
document
  .getElementById("cancel-customer-modal")
  .addEventListener("click", closeCustomerModal);
customerModal.addEventListener("click", (event) => {
  if (event.target === customerModal) closeCustomerModal();
});
document
  .getElementById("customer-form")
  .addEventListener("submit", async (event) => {
    event.preventDefault();
    customerFormError.hidden = true;
    try {
      await api("/api/customers", {
        method: "POST",
        body: JSON.stringify({
          name: document.getElementById("customer-name").value,
          email: document.getElementById("customer-email").value,
        }),
      });
      closeCustomerModal();
      event.target.reset();
      await showView("customers");
      toast.querySelector("strong").textContent = "Customer created";
      toast.querySelector("small").textContent =
        "The customer is ready for license issuance.";
      toast.classList.add("show");
      window.setTimeout(() => toast.classList.remove("show"), 4200);
    } catch (error) {
      customerFormError.textContent = error.message;
      customerFormError.hidden = false;
    }
  });

const profileModal = document.getElementById("profile-modal");
const profileFormError = document.getElementById("profile-form-error");
document.getElementById("profile-trial-days")?.closest("label").remove();
document.getElementById("profile-pro-days")?.closest("label").remove();
let editingProfileId = null;
const profileOptionsEditor = document.createElement("div");
profileOptionsEditor.id = "profile-options-editor";
profileOptionsEditor.className = "profile-options-editor";
document
  .getElementById("profile-features")
  .closest("label")
  .after(profileOptionsEditor);
function closeProfileModal() {
  profileModal.hidden = true;
}
function renderProfileOptions(profile) {
  if (!profile) {
    profileOptionsEditor.innerHTML = "";
    return;
  }
  profileOptionsEditor.innerHTML = `<div class="option-editor-heading"><strong>License options</strong><small>Remove unused options or add a package with its own duration.</small></div><div class="profile-option-list">${(profile.license_options || []).map((option) => `<div class="profile-option-row"><span>${escapeHtml(option.label)}</span><small>${escapeHtml(option.type)} · ${option.length_days} days</small><button type="button" class="delete-option" data-option-delete="${escapeHtml(option.id)}">Remove</button></div>`).join("")}</div><div class="option-add-row"><select id="new-option-type"><option value="trial">Trial</option><option value="pro">Pro</option><option value="base">Base</option></select><input id="new-option-days" type="number" min="1" placeholder="Length in days"><input id="new-option-label" placeholder="Option label"><button type="button" class="secondary-button" id="add-option">Add option</button></div>`;
}
async function openProfileModal(profile = null) {
  editingProfileId = profile?.app_id || null;
  profileModal.hidden = false;
  document.getElementById("profile-modal-title").textContent = profile
    ? `Edit ${profile.name}`
    : "Add app profile";
  document.querySelector('#profile-form button[type="submit"]').innerHTML =
    profile ? "Save changes <span>→</span>" : "Create profile <span>→</span>";
  document.getElementById("profile-app-id").readOnly = Boolean(profile);
  document.getElementById("profile-app-id").value = profile?.app_id || "";
  document.getElementById("profile-name").value = profile?.name || "";
  document.getElementById("profile-installation-limit").value =
    profile?.installation_limit || 1;
  document.getElementById("profile-features").value = (
    profile?.features || []
  ).join(", ");
  renderProfileOptions(profile);
  document.getElementById("profile-app-id").focus();
}
document
  .getElementById("close-profile-modal")
  .addEventListener("click", closeProfileModal);
document
  .getElementById("cancel-profile-modal")
  .addEventListener("click", closeProfileModal);
profileModal.addEventListener("click", (event) => {
  if (event.target === profileModal) closeProfileModal();
});
document
  .getElementById("profile-form")
  .addEventListener("submit", async (event) => {
    event.preventDefault();
    profileFormError.hidden = true;
    try {
      const profilePayload = {
        app_id: document.getElementById("profile-app-id").value,
        name: document.getElementById("profile-name").value,
        installation_limit: Number(
          document.getElementById("profile-installation-limit").value,
        ),
        features: document
          .getElementById("profile-features")
          .value.split(",")
          .map((feature) => feature.trim())
          .filter(Boolean),
      };
      if (editingProfileId)
        await api(`/api/app-profiles/${encodeURIComponent(editingProfileId)}`, {
          method: "PUT",
          body: JSON.stringify(profilePayload),
        });
      else
        await api("/api/app-profiles", {
          method: "POST",
          body: JSON.stringify(profilePayload),
        });
      closeProfileModal();
      event.target.reset();
      await showView("profiles");
      toast.classList.add("show");
      toast.querySelector("strong").textContent = "Profile created";
      toast.querySelector("small").textContent =
        "The app profile is ready for licensing.";
      window.setTimeout(() => toast.classList.remove("show"), 4200);
    } catch (error) {
      profileFormError.textContent = error.message;
      profileFormError.hidden = false;
    }
  });

viewPanel.addEventListener("click", async (event) => {
  if (event.target.closest("#view-action")) {
    const isProfileView =
      document.getElementById("breadcrumb-current").textContent === "Profiles";
    if (isProfileView) openProfileModal();
    else if (
      document.getElementById("breadcrumb-current").textContent === "Customers"
    )
      openCustomerModal();
    else if (
      document.getElementById("breadcrumb-current").textContent === "Licenses"
    )
      openModal();
    return;
  }
  const revokeButton = event.target.closest("[data-license-revoke]");
  if (revokeButton) {
    if (
      !window.confirm(
        "Revoke this license? Existing signed tokens will no longer verify through the issuer.",
      )
    )
      return;
    try {
      await api(
        `/api/licenses/${encodeURIComponent(revokeButton.dataset.licenseRevoke)}/revoke`,
        { method: "POST" },
      );
      await showView("licenses");
      toast.querySelector("strong").textContent = "License revoked";
      toast.querySelector("small").textContent =
        "The license remains available as historical record.";
      toast.classList.add("show");
      window.setTimeout(() => toast.classList.remove("show"), 4200);
    } catch (error) {
      toast.querySelector("strong").textContent = "License not revoked";
      toast.querySelector("small").textContent = error.message;
      toast.classList.add("show");
      window.setTimeout(() => toast.classList.remove("show"), 4200);
    }
    return;
  }
  const deliverButton = event.target.closest("[data-license-deliver]");
  if (deliverButton) {
    try {
      const result = await api(
        `/api/licenses/${encodeURIComponent(deliverButton.dataset.licenseDeliver)}/reissue`,
        { method: "POST" },
      );
      showLicenseDelivery(result);
    } catch (error) {
      toast.querySelector("strong").textContent = "License not available";
      toast.querySelector("small").textContent = error.message;
      toast.classList.add("show");
      window.setTimeout(() => toast.classList.remove("show"), 4200);
    }
    return;
  }
  const editButton = event.target.closest("[data-profile-edit]");
  if (editButton) {
    try {
      const state = await api("/api/state");
      await openProfileModal(
        state.profiles.find(
          (profile) => profile.app_id === editButton.dataset.profileEdit,
        ),
      );
    } catch (error) {
      profileFormError.textContent = error.message;
      profileFormError.hidden = false;
    }
    return;
  }
  const deleteButton = event.target.closest("[data-profile-delete]");
  const customerDeleteButton = event.target.closest("[data-customer-delete]");
  if (customerDeleteButton) {
    if (
      !window.confirm(
        "Delete this customer? This action removes the customer record but does not affect revoked license history.",
      )
    )
      return;
    try {
      await api(
        `/api/customers/${encodeURIComponent(customerDeleteButton.dataset.customerDelete)}`,
        { method: "DELETE" },
      );
      await showView("customers");
    } catch (error) {
      toast.querySelector("strong").textContent = "Customer not deleted";
      toast.querySelector("small").textContent = error.message;
      toast.classList.add("show");
      window.setTimeout(() => toast.classList.remove("show"), 4200);
    }
    return;
  }
  if (!deleteButton) return;
  if (
    !window.confirm(
      `Delete the ${deleteButton.dataset.profileDelete} application profile?`,
    )
  )
    return;
  try {
    await api(
      `/api/app-profiles/${encodeURIComponent(deleteButton.dataset.profileDelete)}`,
      { method: "DELETE" },
    );
    await showView("profiles");
  } catch (error) {
    profileFormError.textContent = error.message;
    profileFormError.hidden = false;
    openProfileModal();
  }
});

profileOptionsEditor.addEventListener("click", async (event) => {
  if (event.target.id === "add-option") {
    try {
      await api(
        `/api/app-profiles/${encodeURIComponent(editingProfileId)}/license-options`,
        {
          method: "POST",
          body: JSON.stringify({
            type: document.getElementById("new-option-type").value,
            length_days: Number(
              document.getElementById("new-option-days").value,
            ),
            label: document.getElementById("new-option-label").value,
          }),
        },
      );
      const state = await api("/api/state");
      renderProfileOptions(
        state.profiles.find((profile) => profile.app_id === editingProfileId),
      );
      await showView("profiles");
    } catch (error) {
      profileFormError.textContent = error.message;
      profileFormError.hidden = false;
    }
  }
  const removeButton = event.target.closest("[data-option-delete]");
  if (removeButton) {
    if (
      !window.confirm(
        "Remove this license option? Active licenses using it will prevent removal.",
      )
    )
      return;
    try {
      await api(
        `/api/app-profiles/${encodeURIComponent(editingProfileId)}/license-options/${encodeURIComponent(removeButton.dataset.optionDelete)}`,
        { method: "DELETE" },
      );
      const state = await api("/api/state");
      renderProfileOptions(
        state.profiles.find((profile) => profile.app_id === editingProfileId),
      );
      await showView("profiles");
    } catch (error) {
      profileFormError.textContent = error.message;
      profileFormError.hidden = false;
    }
  }
});

function closeUserProfile() {
  userProfileModal.hidden = true;
}
document.getElementById("open-user-profile").addEventListener("click", () => {
  userProfileModal.hidden = false;
  document.getElementById("user-profile-name").focus();
});
document
  .getElementById("close-user-profile")
  .addEventListener("click", closeUserProfile);
document
  .getElementById("cancel-user-profile")
  .addEventListener("click", closeUserProfile);
userProfileModal.addEventListener("click", (event) => {
  if (event.target === userProfileModal) closeUserProfile();
});
document
  .getElementById("user-profile-form")
  .addEventListener("submit", async (event) => {
    event.preventDefault();
    const errorElement = document.getElementById("user-profile-error");
    errorElement.hidden = true;
    try {
      const result = await api("/api/auth/profile", {
        method: "PUT",
        body: JSON.stringify({
          name: document.getElementById("user-profile-name").value,
          email: document.getElementById("user-profile-email").value,
        }),
      });
      updateUserProfile(result.profile);
      closeUserProfile();
    } catch (error) {
      errorElement.textContent = error.message;
      errorElement.hidden = false;
    }
  });

const deliveryModal = document.getElementById("license-delivery-modal");
function showLicenseDelivery(result) {
  deliveryModal.hidden = false;
  document.getElementById("license-token-output").value = result.token;
  document.getElementById("license-delivery-summary").textContent =
    `${result.license.app_id} · ${result.license.option_type} · expires ${new Date(result.license.expires_at).toLocaleDateString()}`;
}
function closeLicenseDelivery() {
  deliveryModal.hidden = true;
}
document
  .getElementById("close-license-delivery")
  .addEventListener("click", closeLicenseDelivery);
deliveryModal.addEventListener("click", (event) => {
  if (event.target === deliveryModal) closeLicenseDelivery();
});
document
  .getElementById("copy-license-token")
  .addEventListener("click", async () => {
    await navigator.clipboard.writeText(
      document.getElementById("license-token-output").value,
    );
    document.getElementById("copy-license-token").textContent = "Copied";
    window.setTimeout(() => {
      document.getElementById("copy-license-token").textContent = "Copy token";
    }, 1800);
  });
document
  .getElementById("download-license-token")
  .addEventListener("click", () => {
    const token = document.getElementById("license-token-output").value;
    const blob = new Blob([token], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "keystone-license.token";
    link.click();
    URL.revokeObjectURL(link.href);
  });

viewPanel.addEventListener("click", (event) => {
  const row = event.target.closest("[data-customer-focus]");
  if (!row || event.target.closest("[data-customer-delete]")) return;
  focusedCustomerId = row.dataset.customerFocus;
  document.querySelector('.nav-item[data-view="licenses"]').click();
});
viewPanel.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const row = event.target.closest("[data-customer-focus]");
  if (!row || event.target.closest("[data-customer-delete]")) return;
  event.preventDefault();
  focusedCustomerId = row.dataset.customerFocus;
  document.querySelector('.nav-item[data-view="licenses"]').click();
});
