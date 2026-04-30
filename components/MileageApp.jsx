"use client";

import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "mileage-reimbursement-draft-v1";

const defaultConfig = {
  googleMapsBrowserKey: "",
  routesConfigured: false,
  mondayConfigured: false,
  workplaceNames: [],
  locationPresets: []
};

const defaultProfile = {
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
};

const defaultData = {
  profile: defaultProfile,
  settings: { deductionPolicy: "home_boundary" },
  notes: "",
  trips: [createTrip("trip-1", "stop-1")]
};

export default function MileageApp() {
  const [config, setConfig] = useState(defaultConfig);
  const [data, setData] = useState(defaultData);
  const [calculation, setCalculation] = useState(null);
  const [message, setMessage] = useState({ text: "", kind: "" });
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      const nextConfig = await fetchJson("/api/config").catch(() => defaultConfig);
      if (!active) return;
      setConfig(nextConfig);

      const draft = loadDraft();
      if (draft) {
        setData(draft);
      } else {
        setData((current) => ({
          ...current,
          trips: current.trips.map((trip) => ({ ...trip, date: trip.date || today() }))
        }));
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!config.googleMapsBrowserKey || typeof window === "undefined") return;

    window.initMileagePlaces = () => attachAutocomplete(setData);
    if (window.google?.maps?.places) {
      attachAutocomplete(setData);
      return;
    }

    if (document.querySelector("script[data-google-places-script='true']")) return;
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(config.googleMapsBrowserKey)}&libraries=places&callback=initMileagePlaces&loading=async`;
    script.async = true;
    script.dataset.googlePlacesScript = "true";
    document.head.appendChild(script);
  }, [config.googleMapsBrowserKey, data.trips.length]);

  useEffect(() => {
    attachAutocomplete(setData);
  }, [data, config.googleMapsBrowserKey]);

  const workplaceOptions = useMemo(() => {
    const presetNames = config.locationPresets.map((location) => location.name);
    return config.workplaceNames.length ? config.workplaceNames : presetNames;
  }, [config.locationPresets, config.workplaceNames]);

  const workplaceAddressPreset = findPresetValueByAddress(config.locationPresets, data.profile.workplaceAddress);
  const canSubmit = config.mondayConfigured && !isSubmitting;

  function updateProfile(field, value) {
    setData((current) => {
      const profile = { ...current.profile, [field]: value };
      if (field === "primaryWorkplace") {
        const location = findPresetByWorkplaceName(config.locationPresets, value);
        if (location) profile.workplaceAddress = location.address;
      }
      return { ...current, profile };
    });
    clearMessage();
  }

  function applyWorkplacePreset(name) {
    const location = findPresetByName(config.locationPresets, name);
    if (!location) return;
    setData((current) => ({
      ...current,
      profile: {
        ...current.profile,
        primaryWorkplace: location.name,
        workplaceAddress: location.address
      }
    }));
    clearMessage();
  }

  function updateSettings(field, value) {
    setData((current) => ({
      ...current,
      settings: { ...current.settings, [field]: value }
    }));
    clearMessage();
  }

  function updateTrip(tripId, field, value) {
    setData((current) => ({
      ...current,
      trips: current.trips.map((trip) => (trip.id === tripId ? { ...trip, [field]: value } : trip))
    }));
    clearMessage();
  }

  function updateStop(tripId, stopId, field, value) {
    setData((current) => ({
      ...current,
      trips: current.trips.map((trip) => {
        if (trip.id !== tripId) return trip;
        return {
          ...trip,
          stops: trip.stops.map((stop) => (stop.id === stopId ? { ...stop, [field]: value } : stop))
        };
      })
    }));
    clearMessage();
  }

  function applyStopPreset(tripId, stopId, name) {
    const location = findPresetByName(config.locationPresets, name);
    if (!location) return;
    setData((current) => ({
      ...current,
      trips: current.trips.map((trip) => {
        if (trip.id !== tripId) return trip;
        return {
          ...trip,
          stops: trip.stops.map((stop) =>
            stop.id === stopId ? { ...stop, label: location.name, address: location.address } : stop
          )
        };
      })
    }));
    clearMessage();
  }

  function addTrip() {
    setData((current) => ({
      ...current,
      trips: [...current.trips, createTrip()]
    }));
    clearMessage();
  }

  function removeTrip(tripId) {
    setData((current) => ({
      ...current,
      trips: current.trips.filter((trip) => trip.id !== tripId)
    }));
    setCalculation(null);
    clearMessage();
  }

  function addStop(tripId) {
    setData((current) => ({
      ...current,
      trips: current.trips.map((trip) =>
        trip.id === tripId ? { ...trip, stops: [...trip.stops, createStop()] } : trip
      )
    }));
    clearMessage();
  }

  function removeStop(tripId, stopId) {
    setData((current) => ({
      ...current,
      trips: current.trips.map((trip) =>
        trip.id === tripId ? { ...trip, stops: trip.stops.filter((stop) => stop.id !== stopId) } : trip
      )
    }));
    setCalculation(null);
    clearMessage();
  }

  function saveDraft() {
    persistDraft(data);
    setMessage({ text: "Draft saved in this browser.", kind: "ready" });
  }

  function loadDemoData() {
    const workplace = config.locationPresets[0] || { name: "KEI HQ", address: "" };
    const stop = config.locationPresets[1] || { name: "Market run", address: "Irvine Spectrum Center, Irvine, CA" };
    const nextData = {
      profile: {
        name: "Demo Employee",
        requesterEmail: "employee@example.com",
        position: "Manager",
        approverEmail: "approver@example.com",
        payrollEmail: "accounting@keiconcepts.info",
        primaryWorkplace: workplace.name,
        homeAddress: "100 Spectrum Center Dr, Irvine, CA",
        workplaceAddress: workplace.address,
        commuteMilesOneWay: "",
        reimbursementRate: ""
      },
      settings: { deductionPolicy: "home_boundary" },
      notes: "",
      trips: [
        {
          ...createTrip(),
          date: today(),
          stops: [{ id: createId(), label: stop.name, address: stop.address }]
        }
      ]
    };
    setData(nextData);
    setCalculation(null);
    persistDraft(nextData);
    clearMessage();
  }

  async function calculateMiles() {
    clearMessage();

    if (!config.routesConfigured && hasTripsMissingManualMiles(data.trips)) {
      setMessage({
        text: "Automatic route mileage needs GOOGLE_MAPS_API_KEY in .env. Until that key is added, enter an Actual miles override for each trip day.",
        kind: "error"
      });
      return;
    }

    setIsCalculating(true);
    try {
      const result = await fetchJson("/api/calculate", {
        method: "POST",
        body: JSON.stringify(data)
      });
      setCalculation(result.calculation);
      persistDraft(data);
    } catch (error) {
      setMessage({ text: error.message, kind: "error" });
    } finally {
      setIsCalculating(false);
    }
  }

  async function submitToMonday() {
    clearMessage();
    setIsSubmitting(true);
    try {
      const result = await fetchJson("/api/submit", {
        method: "POST",
        body: JSON.stringify(data)
      });
      setCalculation(result.calculation);
      setMessage({ text: `Submitted to Monday as item ${result.item.id}.`, kind: "ready" });
    } catch (error) {
      setMessage({ text: error.message, kind: "error" });
    } finally {
      setIsSubmitting(false);
    }
  }

  function clearMessage() {
    setMessage({ text: "", kind: "" });
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Work mileage</p>
          <h1>Mileage Reimbursement</h1>
        </div>
        <div className="system-status" aria-live="polite">
          <span className={`status-pill ${config.routesConfigured ? "ready" : "warning"}`}>
            Routes: {config.routesConfigured ? "ready" : "needs key"}
          </span>
          <span className={`status-pill ${config.mondayConfigured ? "ready" : "warning"}`}>
            Monday: {config.mondayConfigured ? "ready" : "not set"}
          </span>
        </div>
      </header>

      <main className="layout">
        <form className="workspace" autoComplete="on" onSubmit={(event) => event.preventDefault()}>
          <section className="panel">
            <div className="panel-heading">
              <h2>Employee</h2>
              <button type="button" className="secondary-button compact" onClick={saveDraft}>
                Save draft
              </button>
            </div>
            <div className="field-grid three">
              <TextField label="Name" value={data.profile.name} onChange={(value) => updateProfile("name", value)} required />
              <TextField
                label="Requester email"
                type="email"
                value={data.profile.requesterEmail}
                onChange={(value) => updateProfile("requesterEmail", value)}
                required
              />
              <TextField label="Position" value={data.profile.position} onChange={(value) => updateProfile("position", value)} />
              <TextField
                label="Approver email"
                type="email"
                value={data.profile.approverEmail}
                onChange={(value) => updateProfile("approverEmail", value)}
              />
              <TextField
                label="Payroll email"
                type="email"
                value={data.profile.payrollEmail}
                onChange={(value) => updateProfile("payrollEmail", value)}
              />
              <label>
                <span>Primary workplace</span>
                <select value={data.profile.primaryWorkplace} onChange={(event) => updateProfile("primaryWorkplace", event.target.value)}>
                  <option value="">Select workplace</option>
                  {workplaceOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <h2>Commute</h2>
              <button type="button" className="secondary-button compact" onClick={loadDemoData}>
                Load demo
              </button>
            </div>
            <div className="field-grid two">
              <TextField
                label="Home address"
                value={data.profile.homeAddress}
                onChange={(value) => updateProfile("homeAddress", value)}
                addressField="homeAddress"
              />
              <label>
                <span>Primary workplace address</span>
                <select value={workplaceAddressPreset} onChange={(event) => applyWorkplacePreset(event.target.value)}>
                  <option value="">Select saved address</option>
                  {config.locationPresets.map((location) => (
                    <option key={location.name} value={location.name}>
                      {location.name}
                    </option>
                  ))}
                </select>
                <input
                  className="address-input"
                  value={data.profile.workplaceAddress}
                  data-address-autocomplete="true"
                  data-profile-address-field="workplaceAddress"
                  onChange={(event) => updateProfile("workplaceAddress", event.target.value)}
                />
              </label>
              <TextField
                label="One-way commute miles"
                type="number"
                min="0"
                step="0.1"
                placeholder="Auto or manual"
                value={data.profile.commuteMilesOneWay}
                onChange={(value) => updateProfile("commuteMilesOneWay", value)}
              />
              <TextField
                label="Reimbursement rate"
                type="number"
                min="0"
                step="0.001"
                placeholder="Optional"
                value={data.profile.reimbursementRate}
                onChange={(value) => updateProfile("reimbursementRate", value)}
              />
            </div>
            <label className="full-field">
              <span>Deduction rule</span>
              <select value={data.settings.deductionPolicy} onChange={(event) => updateSettings("deductionPolicy", event.target.value)}>
                <option value="home_boundary">Home boundary legs</option>
                <option value="round_trip_per_day">Round trip per day</option>
                <option value="field_only">Field departure only</option>
                <option value="none">No commute deduction</option>
              </select>
            </label>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <h2>Trip Days</h2>
              <button type="button" className="primary-button compact" onClick={addTrip}>
                + Add day
              </button>
            </div>
            <div className="trip-list">
              {data.trips.length ? (
                data.trips.map((trip, index) => (
                  <TripEditor
                    key={trip.id}
                    trip={trip}
                    index={index}
                    locationPresets={config.locationPresets}
                    onTripChange={updateTrip}
                    onStopChange={updateStop}
                    onStopPreset={applyStopPreset}
                    onAddStop={addStop}
                    onRemoveStop={removeStop}
                    onRemoveTrip={removeTrip}
                  />
                ))
              ) : (
                <div className="empty-state">No trip days added.</div>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <h2>Notes</h2>
            </div>
            <label className="full-field">
              <span>Submission notes</span>
              <textarea
                rows="3"
                value={data.notes}
                onChange={(event) => {
                  setData((current) => ({ ...current, notes: event.target.value }));
                  clearMessage();
                }}
              />
            </label>
          </section>
        </form>

        <SummaryPanel
          calculation={calculation}
          message={message}
          canSubmit={canSubmit}
          isCalculating={isCalculating}
          isSubmitting={isSubmitting}
          onCalculate={calculateMiles}
          onSubmit={submitToMonday}
        />
      </main>
    </div>
  );
}

function TextField({ label, value, onChange, addressField, ...props }) {
  return (
    <label>
      <span>{label}</span>
      <input
        {...props}
        className={addressField ? "address-input" : undefined}
        value={value}
        data-address-autocomplete={addressField ? "true" : undefined}
        data-profile-address-field={addressField}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function TripEditor({
  trip,
  index,
  locationPresets,
  onTripChange,
  onStopChange,
  onStopPreset,
  onAddStop,
  onRemoveStop,
  onRemoveTrip
}) {
  const title = trip.date ? `Trip ${index + 1} - ${trip.date}` : `Trip ${index + 1}`;

  return (
    <article className="trip-block" data-trip-id={trip.id}>
      <div className="trip-heading">
        <h3>{title}</h3>
        <button type="button" className="danger-button compact" onClick={() => onRemoveTrip(trip.id)}>
          Remove day
        </button>
      </div>

      <div className="trip-grid">
        <TextField label="Date" type="date" value={trip.date} onChange={(value) => onTripChange(trip.id, "date", value)} />
        <EndpointEditor prefix="start" trip={trip} onTripChange={onTripChange} />
        <EndpointEditor prefix="end" trip={trip} onTripChange={onTripChange} />
      </div>

      <div className="stops">
        <div className="stop-toolbar">
          <h3>Stops</h3>
          <button type="button" className="secondary-button compact" onClick={() => onAddStop(trip.id)}>
            + Add stop
          </button>
        </div>
        {trip.stops.length ? (
          trip.stops.map((stop) => (
            <StopEditor
              key={stop.id}
              tripId={trip.id}
              stop={stop}
              locationPresets={locationPresets}
              onStopChange={onStopChange}
              onStopPreset={onStopPreset}
              onRemoveStop={onRemoveStop}
            />
          ))
        ) : (
          <div className="empty-state">No work stops added.</div>
        )}
      </div>

      <div className="field-grid two">
        <TextField
          label="Actual miles override"
          type="number"
          min="0"
          step="0.1"
          placeholder="Auto or manual"
          value={trip.manualActualMiles}
          onChange={(value) => onTripChange(trip.id, "manualActualMiles", value)}
        />
        <TextField label="Trip notes" value={trip.notes} onChange={(value) => onTripChange(trip.id, "notes", value)} />
      </div>
    </article>
  );
}

function EndpointEditor({ prefix, trip, onTripChange }) {
  const typeField = `${prefix}Type`;
  const addressField = `${prefix}Address`;
  const labelField = `${prefix}Label`;
  const isOther = trip[typeField] === "other";
  const label = prefix === "start" ? "Start" : "End";

  return (
    <div className="input-group">
      <span>{label}</span>
      <div className="endpoint-grid">
        <select value={trip[typeField]} onChange={(event) => onTripChange(trip.id, typeField, event.target.value)}>
          <option value="home">Home</option>
          <option value="office">Primary workplace</option>
          <option value="other">Other</option>
        </select>
        <input
          className="address-input"
          value={trip[addressField]}
          disabled={!isOther}
          placeholder={isOther ? "Other address" : "Uses saved address"}
          data-address-autocomplete={isOther ? "true" : undefined}
          data-trip-id={trip.id}
          data-trip-address-field={addressField}
          onChange={(event) => onTripChange(trip.id, addressField, event.target.value)}
        />
      </div>
      {isOther ? (
        <input
          value={trip[labelField]}
          placeholder="Optional label"
          onChange={(event) => onTripChange(trip.id, labelField, event.target.value)}
        />
      ) : null}
    </div>
  );
}

function StopEditor({ tripId, stop, locationPresets, onStopChange, onStopPreset, onRemoveStop }) {
  const presetValue = findPresetValueByAddress(locationPresets, stop.address);

  return (
    <div className="stop-row" data-stop-id={stop.id}>
      <TextField label="Label" placeholder="Client or site" value={stop.label} onChange={(value) => onStopChange(tripId, stop.id, "label", value)} />
      <label>
        <span>Quick address</span>
        <select value={presetValue} onChange={(event) => onStopPreset(tripId, stop.id, event.target.value)}>
          <option value="">Custom address</option>
          {locationPresets.map((location) => (
            <option key={location.name} value={location.name}>
              {location.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Address</span>
        <input
          className="address-input"
          value={stop.address}
          data-address-autocomplete="true"
          data-trip-id={tripId}
          data-stop-id={stop.id}
          data-stop-address-field="address"
          onChange={(event) => onStopChange(tripId, stop.id, "address", event.target.value)}
        />
      </label>
      <button type="button" className="icon-button" onClick={() => onRemoveStop(tripId, stop.id)} aria-label="Remove stop">
        x
      </button>
    </div>
  );
}

function SummaryPanel({ calculation, message, canSubmit, isCalculating, isSubmitting, onCalculate, onSubmit }) {
  const totals = calculation?.totals || {};

  return (
    <aside className="summary-panel" aria-live="polite">
      <div className="summary-header">
        <div>
          <p className="eyebrow">Review</p>
          <h2>Submission total</h2>
        </div>
        <div className="total-badge">
          <span>{formatMiles(totals.reimbursableMiles)}</span>
          <small>miles</small>
        </div>
      </div>

      <div className="metric-grid">
        <Metric label="Actual" value={formatMiles(totals.actualMiles)} />
        <Metric label="Deduction" value={formatMiles(totals.commuteDeductionMiles)} />
        <Metric
          label="Amount"
          value={totals.reimbursementAmount === null || totals.reimbursementAmount === undefined ? "-" : `$${totals.reimbursementAmount.toFixed(2)}`}
        />
      </div>

      <div className="route-visual" aria-hidden="true">
        <div className="route-line"></div>
        <div className="route-node home">H</div>
        <div className="route-node work">W</div>
        <div className="route-node stop">S</div>
      </div>

      <div className="result-list">
        {(calculation?.trips || []).map((trip) => (
          <div key={trip.id || trip.routeLabel} className="result-item">
            <strong>
              {trip.date || "Trip day"} - {formatMiles(trip.reimbursableMiles)} mi reimbursable
            </strong>
            <span>{trip.routeLabel}</span>
          </div>
        ))}
      </div>

      <div className="warning-list">
        {(calculation?.warnings || []).map((warning) => (
          <div key={warning} className="warning-item">
            {warning}
          </div>
        ))}
      </div>

      {message.text ? <div className={`submit-message ${message.kind}`}>{message.text}</div> : null}

      <div className="action-row">
        <button type="button" className="secondary-button" onClick={onCalculate} disabled={isCalculating}>
          {isCalculating ? "Calculating" : "Calculate miles"}
        </button>
        <button type="button" className="primary-button" onClick={onSubmit} disabled={!canSubmit}>
          {isSubmitting ? "Submitting" : "Submit to Monday"}
        </button>
      </div>
    </aside>
  );
}

function Metric({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function attachAutocomplete(setData) {
  if (typeof window === "undefined" || !window.google?.maps?.places) return;

  for (const input of document.querySelectorAll("input[data-address-autocomplete='true']:not([disabled])")) {
    if (input.dataset.autocompleteAttached) continue;
    const autocomplete = new window.google.maps.places.Autocomplete(input, {
      componentRestrictions: { country: "us" },
      fields: ["formatted_address", "name"]
    });
    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      const value = place.formatted_address || place.name || input.value;
      setData((current) => applyAutocompleteValue(current, input, value));
    });
    input.dataset.autocompleteAttached = "true";
  }
}

function applyAutocompleteValue(current, input, value) {
  const profileField = input.dataset.profileAddressField;
  if (profileField) {
    return {
      ...current,
      profile: { ...current.profile, [profileField]: value }
    };
  }

  const tripId = input.dataset.tripId;
  const tripField = input.dataset.tripAddressField;
  if (tripId && tripField) {
    return {
      ...current,
      trips: current.trips.map((trip) => (trip.id === tripId ? { ...trip, [tripField]: value } : trip))
    };
  }

  const stopId = input.dataset.stopId;
  const stopField = input.dataset.stopAddressField;
  if (tripId && stopId && stopField) {
    return {
      ...current,
      trips: current.trips.map((trip) => {
        if (trip.id !== tripId) return trip;
        return {
          ...trip,
          stops: trip.stops.map((stop) => (stop.id === stopId ? { ...stop, [stopField]: value } : stop))
        };
      })
    };
  }

  return current;
}

function createTrip(tripId = createId(), stopId = createId()) {
  return {
    id: tripId,
    date: today(),
    startType: "home",
    startAddress: "",
    startLabel: "",
    endType: "home",
    endAddress: "",
    endLabel: "",
    manualActualMiles: "",
    notes: "",
    stops: [createStop(stopId)]
  };
}

function createStop(id = createId()) {
  return { id, label: "", address: "" };
}

function createId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function loadDraft() {
  if (typeof window === "undefined") return null;

  try {
    const draft = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (!draft.profile || !Array.isArray(draft.trips)) return null;
    return {
      profile: { ...defaultProfile, ...draft.profile },
      settings: { deductionPolicy: "home_boundary", ...(draft.settings || {}) },
      notes: typeof draft.notes === "string" ? draft.notes : "",
      trips: draft.trips.length ? draft.trips : [createTrip()]
    };
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function persistDraft(data) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function findPresetByName(locationPresets, name) {
  return locationPresets.find((location) => location.name === name);
}

function findPresetByWorkplaceName(locationPresets, name) {
  return locationPresets.find((location) => normalizeText(location.name) === normalizeText(name));
}

function findPresetValueByAddress(locationPresets, address) {
  const normalizedAddress = normalizeText(address);
  if (!normalizedAddress) return "";
  return locationPresets.find((location) => normalizeText(location.address) === normalizedAddress)?.name || "";
}

function hasTripsMissingManualMiles(trips) {
  return trips.some((trip) => {
    const value = Number(trip.manualActualMiles);
    return trip.manualActualMiles === "" || !Number.isFinite(value) || value < 0;
  });
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
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
  if (!response.ok) throw new Error(body.error || response.statusText);
  return body;
}
