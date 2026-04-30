const STORAGE_KEY = "mileage-reimbursement-draft-v1";

const state = {
  config: {
    googleMapsBrowserKey: "",
    routesConfigured: false,
    mondayConfigured: false,
    workplaceNames: [],
    locationPresets: []
  },
  profile: {
    name: "",
    requesterEmail: "",
    position: "",
    approverEmail: "",
    payrollEmail: "accounting@keiconcepts.info",
    primaryWorkplace: "",
    homeAddress: "",
    workplaceAddress: "",
    commuteMilesOneWay: "",
    reimbursementRate: ""
  },
  settings: {
    deductionPolicy: "home_boundary"
  },
  notes: "",
  trips: [createTrip()],
  lastCalculation: null
};

const elements = {
  form: document.querySelector("#mileageForm"),
  tripList: document.querySelector("#tripList"),
  routesStatus: document.querySelector("#routesStatus"),
  mondayStatus: document.querySelector("#mondayStatus"),
  primaryWorkplace: document.querySelector("#primaryWorkplace"),
  workplaceAddressPreset: document.querySelector("#workplaceAddressPreset"),
  calculateButton: document.querySelector("#calculateButton"),
  submitButton: document.querySelector("#submitButton"),
  addTripButton: document.querySelector("#addTripButton"),
  saveDraftButton: document.querySelector("#saveDraftButton"),
  loadDemoButton: document.querySelector("#loadDemoButton"),
  actualMiles: document.querySelector("#actualMiles"),
  deductionMiles: document.querySelector("#deductionMiles"),
  reimbursableMiles: document.querySelector("#reimbursableMiles"),
  reimbursementAmount: document.querySelector("#reimbursementAmount"),
  tripResults: document.querySelector("#tripResults"),
  warningList: document.querySelector("#warningList"),
  submitMessage: document.querySelector("#submitMessage")
};

init();

async function init() {
  loadDraft();
  await loadConfig();
  renderWorkplaceOptions();
  writeStaticFields();
  renderTrips();
  bindEvents();
  updateSubmitState();
  loadGooglePlaces();
}

function bindEvents() {
  const profileFields = [
    "name",
    "requesterEmail",
    "position",
    "approverEmail",
    "payrollEmail",
    "primaryWorkplace",
    "homeAddress",
    "workplaceAddress",
    "commuteMilesOneWay",
    "reimbursementRate"
  ];

  for (const field of profileFields) {
    const input = document.querySelector(`#${field}`);
    const handleProfileChange = (event) => {
      state.profile[field] = event.target.value;
      if (field === "primaryWorkplace") {
        const location = findPresetByWorkplaceName(event.target.value);
        if (location) {
          state.profile.workplaceAddress = location.address;
          document.querySelector("#workplaceAddress").value = location.address;
          elements.workplaceAddressPreset.value = location.name;
        }
      }
      if (field === "workplaceAddress") {
        elements.workplaceAddressPreset.value = findPresetValueByAddress(event.target.value);
      }
      clearSubmitMessage();
    };
    input.addEventListener("input", handleProfileChange);
    input.addEventListener("change", handleProfileChange);
  }

  elements.workplaceAddressPreset.addEventListener("change", (event) => {
    const location = findPresetByName(event.target.value);
    if (!location) return;
    state.profile.primaryWorkplace = location.name;
    state.profile.workplaceAddress = location.address;
    elements.primaryWorkplace.value = location.name;
    document.querySelector("#workplaceAddress").value = location.address;
    clearSubmitMessage();
  });

  document.querySelector("#deductionPolicy").addEventListener("input", (event) => {
    state.settings.deductionPolicy = event.target.value;
    clearSubmitMessage();
  });

  document.querySelector("#notes").addEventListener("input", (event) => {
    state.notes = event.target.value;
    clearSubmitMessage();
  });

  elements.addTripButton.addEventListener("click", () => {
    state.trips.push(createTrip());
    renderTrips();
    persistDraft();
  });

  elements.saveDraftButton.addEventListener("click", () => {
    persistDraft();
    showSubmitMessage("Draft saved in this browser.", "ready");
  });

  elements.loadDemoButton.addEventListener("click", () => {
    loadDemoData();
    renderWorkplaceOptions();
    writeStaticFields();
    renderTrips();
    renderCalculation(null);
    persistDraft();
  });

  elements.calculateButton.addEventListener("click", calculateMiles);
  elements.submitButton.addEventListener("click", submitToMonday);

  elements.tripList.addEventListener("input", handleTripInput);
  elements.tripList.addEventListener("change", handleTripInput);
  elements.tripList.addEventListener("click", handleTripClick);
}

async function loadConfig() {
  try {
    const config = await fetchJson("/api/config");
    state.config = config;
  } catch {
    state.config = {
      googleMapsBrowserKey: "",
      routesConfigured: false,
      mondayConfigured: false,
      workplaceNames: [],
      locationPresets: []
    };
  }

  elements.routesStatus.textContent = state.config.routesConfigured ? "Routes: ready" : "Routes: needs key";
  elements.routesStatus.className = `status-pill ${state.config.routesConfigured ? "ready" : "warning"}`;
  elements.mondayStatus.textContent = state.config.mondayConfigured ? "Monday: ready" : "Monday: not set";
  elements.mondayStatus.className = `status-pill ${state.config.mondayConfigured ? "ready" : "warning"}`;
}

function updateSubmitState() {
  elements.submitButton.disabled = !state.config.mondayConfigured;
}

function renderWorkplaceOptions() {
  const presetNames = state.config.locationPresets.map((location) => location.name);
  const names = state.config.workplaceNames.length ? state.config.workplaceNames : presetNames;
  elements.primaryWorkplace.innerHTML = [
    `<option value="">Select workplace</option>`,
    ...names.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
  ].join("");
  elements.primaryWorkplace.value = state.profile.primaryWorkplace || "";

  elements.workplaceAddressPreset.innerHTML = renderLocationOptions(state.profile.workplaceAddress, "Select saved address");
  elements.workplaceAddressPreset.value = findPresetValueByAddress(state.profile.workplaceAddress);
}

function writeStaticFields() {
  for (const [key, value] of Object.entries(state.profile)) {
    const input = document.querySelector(`#${key}`);
    if (input) input.value = value || "";
  }

  document.querySelector("#deductionPolicy").value = state.settings.deductionPolicy;
  document.querySelector("#notes").value = state.notes || "";
}

function renderTrips() {
  if (!state.trips.length) {
    elements.tripList.innerHTML = `<div class="empty-state">No trip days added.</div>`;
    return;
  }

  elements.tripList.innerHTML = state.trips.map(renderTrip).join("");
  attachAutocomplete();
}

function renderTrip(trip, index) {
  const title = trip.date ? `Trip ${index + 1} - ${trip.date}` : `Trip ${index + 1}`;
  return `
    <article class="trip-block" data-trip-id="${trip.id}">
      <div class="trip-heading">
        <h3>${escapeHtml(title)}</h3>
        <button type="button" class="danger-button compact" data-action="remove-trip">Remove day</button>
      </div>

      <div class="trip-grid">
        <label>
          <span>Date</span>
          <input type="date" data-trip-field="date" value="${escapeHtml(trip.date)}">
        </label>
        ${renderEndpoint("start", trip.startType, trip.startAddress, trip.startLabel)}
        ${renderEndpoint("end", trip.endType, trip.endAddress, trip.endLabel)}
      </div>

      <div class="stops">
        <div class="stop-toolbar">
          <h3>Stops</h3>
          <button type="button" class="secondary-button compact" data-action="add-stop">+ Add stop</button>
        </div>
        ${trip.stops.map(renderStop).join("") || `<div class="empty-state">No work stops added.</div>`}
      </div>

      <div class="field-grid two">
        <label>
          <span>Actual miles override</span>
          <input type="number" min="0" step="0.1" data-trip-field="manualActualMiles" value="${escapeHtml(trip.manualActualMiles)}" placeholder="Auto or manual">
        </label>
        <label>
          <span>Trip notes</span>
          <input data-trip-field="notes" value="${escapeHtml(trip.notes)}">
        </label>
      </div>
    </article>
  `;
}

function renderEndpoint(prefix, type, address, label) {
  const isOther = type === "other";
  return `
    <div class="input-group">
      <span>${prefix === "start" ? "Start" : "End"}</span>
      <div class="endpoint-grid">
        <select data-trip-field="${prefix}Type">
          <option value="home" ${selected(type, "home")}>Home</option>
          <option value="office" ${selected(type, "office")}>Primary workplace</option>
          <option value="other" ${selected(type, "other")}>Other</option>
        </select>
        <input class="address-input" data-trip-field="${prefix}Address" value="${escapeHtml(address)}" placeholder="${isOther ? "Other address" : "Uses saved address"}" ${isOther ? "" : "disabled"}>
      </div>
      <input data-trip-field="${prefix}Label" value="${escapeHtml(label)}" placeholder="Optional label" ${isOther ? "" : "hidden"}>
    </div>
  `;
}

function renderStop(stop) {
  return `
    <div class="stop-row" data-stop-id="${stop.id}">
      <label>
        <span>Label</span>
        <input data-stop-field="label" value="${escapeHtml(stop.label)}" placeholder="Client or site">
      </label>
      <label>
        <span>Quick address</span>
        <select data-stop-field="preset">
          ${renderLocationOptions(stop.address, "Custom address")}
        </select>
      </label>
      <label>
        <span>Address</span>
        <input class="address-input" data-stop-field="address" value="${escapeHtml(stop.address)}">
      </label>
      <button type="button" class="icon-button" data-action="remove-stop" aria-label="Remove stop">x</button>
    </div>
  `;
}

function handleTripInput(event) {
  const tripBlock = event.target.closest("[data-trip-id]");
  if (!tripBlock) return;
  const trip = state.trips.find((candidate) => candidate.id === tripBlock.dataset.tripId);
  if (!trip) return;

  const tripField = event.target.dataset.tripField;
  const stopField = event.target.dataset.stopField;

  if (tripField) {
    trip[tripField] = event.target.value;
    clearSubmitMessage();
    if (tripField === "startType" || tripField === "endType" || tripField === "date") {
      renderTrips();
    }
  }

  if (stopField) {
    const stopRow = event.target.closest("[data-stop-id]");
    const stop = trip.stops.find((candidate) => candidate.id === stopRow.dataset.stopId);
    if (stop) {
      if (stopField === "preset") {
        const location = findPresetByName(event.target.value);
        if (location) {
          stop.label = location.name;
          stop.address = location.address;
          renderTrips();
        }
      } else {
        stop[stopField] = event.target.value;
      }
      clearSubmitMessage();
    }
  }
}

function handleTripClick(event) {
  const action = event.target.dataset.action;
  if (!action) return;

  const tripBlock = event.target.closest("[data-trip-id]");
  const tripId = tripBlock?.dataset.tripId;
  const trip = state.trips.find((candidate) => candidate.id === tripId);

  if (action === "remove-trip") {
    state.trips = state.trips.filter((candidate) => candidate.id !== tripId);
    renderTrips();
    renderCalculation(null);
    persistDraft();
  }

  if (action === "add-stop" && trip) {
    trip.stops.push(createStop());
    renderTrips();
    persistDraft();
  }

  if (action === "remove-stop" && trip) {
    const stopRow = event.target.closest("[data-stop-id]");
    trip.stops = trip.stops.filter((candidate) => candidate.id !== stopRow.dataset.stopId);
    renderTrips();
    renderCalculation(null);
    persistDraft();
  }
}

async function calculateMiles() {
  syncStaticState();
  clearSubmitMessage();

  if (!state.config.routesConfigured && hasTripsMissingManualMiles()) {
    showSubmitMessage(
      "Automatic route mileage needs GOOGLE_MAPS_API_KEY in .env. Until that key is added, enter an Actual miles override for each trip day.",
      "error"
    );
    return;
  }

  elements.calculateButton.disabled = true;
  elements.calculateButton.textContent = "Calculating";

  try {
    const result = await fetchJson("/api/calculate", {
      method: "POST",
      body: JSON.stringify(toPayload())
    });
    state.lastCalculation = result.calculation;
    renderCalculation(result.calculation);
    persistDraft();
  } catch (error) {
    showSubmitMessage(error.message, "error");
  } finally {
    elements.calculateButton.disabled = false;
    elements.calculateButton.textContent = "Calculate miles";
  }
}

async function submitToMonday() {
  syncStaticState();
  clearSubmitMessage();
  elements.submitButton.disabled = true;
  elements.submitButton.textContent = "Submitting";

  try {
    const result = await fetchJson("/api/submit", {
      method: "POST",
      body: JSON.stringify(toPayload())
    });
    state.lastCalculation = result.calculation;
    renderCalculation(result.calculation);
    showSubmitMessage(`Submitted to Monday as item ${result.item.id}.`, "ready");
  } catch (error) {
    showSubmitMessage(error.message, "error");
  } finally {
    elements.submitButton.disabled = !state.config.mondayConfigured;
    elements.submitButton.textContent = "Submit to Monday";
  }
}

function renderCalculation(calculation) {
  if (!calculation) {
    elements.actualMiles.textContent = "0.0";
    elements.deductionMiles.textContent = "0.0";
    elements.reimbursableMiles.textContent = "0.0";
    elements.reimbursementAmount.textContent = "-";
    elements.tripResults.innerHTML = "";
    elements.warningList.innerHTML = "";
    state.lastCalculation = null;
    return;
  }

  elements.actualMiles.textContent = formatMiles(calculation.totals.actualMiles);
  elements.deductionMiles.textContent = formatMiles(calculation.totals.commuteDeductionMiles);
  elements.reimbursableMiles.textContent = formatMiles(calculation.totals.reimbursableMiles);
  elements.reimbursementAmount.textContent =
    calculation.totals.reimbursementAmount === null ? "-" : `$${calculation.totals.reimbursementAmount.toFixed(2)}`;

  elements.tripResults.innerHTML = calculation.trips
    .map(
      (trip) => `
        <div class="result-item">
          <strong>${escapeHtml(trip.date || "Trip day")} - ${formatMiles(trip.reimbursableMiles)} mi reimbursable</strong>
          <span>${escapeHtml(trip.routeLabel)}</span>
        </div>
      `
    )
    .join("");

  elements.warningList.innerHTML = calculation.warnings
    .map((warning) => `<div class="warning-item">${escapeHtml(warning)}</div>`)
    .join("");
}

function syncStaticState() {
  const profileFields = [
    "name",
    "requesterEmail",
    "position",
    "approverEmail",
    "payrollEmail",
    "primaryWorkplace",
    "homeAddress",
    "workplaceAddress",
    "commuteMilesOneWay",
    "reimbursementRate"
  ];

  for (const field of profileFields) {
    state.profile[field] = document.querySelector(`#${field}`).value;
  }
  state.settings.deductionPolicy = document.querySelector("#deductionPolicy").value;
  state.notes = document.querySelector("#notes").value;
}

function toPayload() {
  return {
    profile: state.profile,
    settings: state.settings,
    notes: state.notes,
    trips: state.trips
  };
}

function persistDraft() {
  syncStaticState();
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      profile: state.profile,
      settings: state.settings,
      notes: state.notes,
      trips: state.trips
    })
  );
}

function loadDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (draft.profile) Object.assign(state.profile, draft.profile);
    if (draft.settings) Object.assign(state.settings, draft.settings);
    if (typeof draft.notes === "string") state.notes = draft.notes;
    if (Array.isArray(draft.trips) && draft.trips.length) state.trips = draft.trips;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function loadDemoData() {
  Object.assign(state.profile, {
    name: "Demo Employee",
    requesterEmail: "employee@example.com",
    position: "Manager",
    approverEmail: "approver@example.com",
    payrollEmail: "accounting@keiconcepts.info",
    primaryWorkplace: state.config.workplaceNames[0] || "KEI HQ",
    homeAddress: "100 Spectrum Center Dr, Irvine, CA",
    workplaceAddress: "3333 Bristol St, Costa Mesa, CA",
    commuteMilesOneWay: "",
    reimbursementRate: ""
  });
  state.settings.deductionPolicy = "home_boundary";
  state.notes = "";
  state.trips = [
    {
      id: createId(),
      date: new Date().toISOString().slice(0, 10),
      startType: "home",
      startAddress: "",
      startLabel: "",
      endType: "home",
      endAddress: "",
      endLabel: "",
      manualActualMiles: "",
      notes: "",
      stops: [
        {
          id: createId(),
          label: "Market run",
          address: "Irvine Spectrum Center, Irvine, CA"
        }
      ]
    }
  ];
}

function renderLocationOptions(currentAddress, emptyLabel) {
  const selectedPreset = findPresetValueByAddress(currentAddress);
  return [
    `<option value="">${escapeHtml(emptyLabel)}</option>`,
    ...state.config.locationPresets.map(
      (location) =>
        `<option value="${escapeHtml(location.name)}" ${selected(selectedPreset, location.name)}>${escapeHtml(location.name)}</option>`
    )
  ].join("");
}

function findPresetByName(name) {
  return state.config.locationPresets.find((location) => location.name === name);
}

function findPresetValueByAddress(address) {
  const normalizedAddress = normalizeText(address);
  if (!normalizedAddress) return "";
  return state.config.locationPresets.find((location) => normalizeText(location.address) === normalizedAddress)?.name || "";
}

function findPresetByWorkplaceName(name) {
  return state.config.locationPresets.find((location) => normalizeText(location.name) === normalizeText(name));
}

function hasTripsMissingManualMiles() {
  return state.trips.some((trip) => {
    const value = Number(trip.manualActualMiles);
    return trip.manualActualMiles === "" || !Number.isFinite(value) || value < 0;
  });
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function createTrip() {
  return {
    id: createId(),
    date: new Date().toISOString().slice(0, 10),
    startType: "home",
    startAddress: "",
    startLabel: "",
    endType: "home",
    endAddress: "",
    endLabel: "",
    manualActualMiles: "",
    notes: "",
    stops: [createStop()]
  };
}

function createStop() {
  return {
    id: createId(),
    label: "",
    address: ""
  };
}

function createId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function selected(value, expected) {
  return value === expected ? "selected" : "";
}

function formatMiles(value) {
  return Number(value || 0).toFixed(1);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || response.statusText);
  }
  return body;
}

function showSubmitMessage(message, kind) {
  elements.submitMessage.textContent = message;
  elements.submitMessage.className = `submit-message ${kind}`;
}

function clearSubmitMessage() {
  elements.submitMessage.textContent = "";
  elements.submitMessage.className = "submit-message";
}

function loadGooglePlaces() {
  if (!state.config.googleMapsBrowserKey) return;
  if (window.google?.maps?.places) {
    attachAutocomplete();
    return;
  }

  window.initMileagePlaces = () => attachAutocomplete();
  const script = document.createElement("script");
  script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(state.config.googleMapsBrowserKey)}&libraries=places&callback=initMileagePlaces`;
  script.async = true;
  document.head.appendChild(script);
}

function attachAutocomplete() {
  if (!window.google?.maps?.places) return;
  for (const input of document.querySelectorAll(".address-input:not([disabled])")) {
    if (input.dataset.autocompleteAttached) continue;
    const autocomplete = new google.maps.places.Autocomplete(input, {
      componentRestrictions: { country: "us" },
      fields: ["formatted_address", "name"]
    });
    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      input.value = place.formatted_address || place.name || input.value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    input.dataset.autocompleteAttached = "true";
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
