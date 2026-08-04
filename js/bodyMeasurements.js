'use strict';

/**
 * =========================================
 * ASCEND BODY MEASUREMENTS & PROGRESS TRACKING
 * =========================================
 * Configuration-driven body measurement tracker.
 * Reads from and persists to localStorage (`ascend_body_measurements`).
 *
 * Features:
 * - Config-driven fields — add a measurement by inserting ONE config object
 * - Editable inputs with per-field validation
 * - Auto-calculated BMI, BMI category, healthy weight range & weight verdict
 * - Progress tracking (current vs previous weight, BMI difference, summary)
 * - View / Edit modes with a single Save action and inline validation
 *
 * Public API: window.ASCEND_BODY
 */

const BODY_STORAGE_KEY = 'ascend_body_measurements';
const BODY_STORAGE_VERSION = 1;
const BODY_HISTORY_LIMIT = 30;

/**
 * Configuration-driven measurement catalog.
 * Future measurements require ONLY one entry here — rendering adapts automatically.
 * Fields: id, label, unit, type ('number' | 'select'), min, max, options, required.
 */
const BODY_FIELDS = [
  { id: 'height', label: 'Height', unit: 'cm', type: 'number', min: 100, max: 250, required: true },
  { id: 'weight', label: 'Weight', unit: 'kg', type: 'number', min: 30, max: 300, required: true },
  { id: 'age', label: 'Age', unit: 'years', type: 'number', min: 10, max: 100, required: true },
  { id: 'gender', label: 'Gender', unit: '', type: 'select', options: ['Male', 'Female', 'Other'], required: true },
  { id: 'bodyFat', label: 'Body Fat', unit: '%', type: 'number', min: 3, max: 60 },
  { id: 'chest', label: 'Chest', unit: 'cm', type: 'number', min: 50, max: 200 },
  { id: 'waist', label: 'Waist', unit: 'cm', type: 'number', min: 40, max: 200 },
  { id: 'hips', label: 'Hips', unit: 'cm', type: 'number', min: 40, max: 200 },
  { id: 'neck', label: 'Neck', unit: 'cm', type: 'number', min: 20, max: 80 },
  { id: 'shoulders', label: 'Shoulders', unit: 'cm', type: 'number', min: 60, max: 180 },
  { id: 'leftArm', label: 'Left Arm', unit: 'cm', type: 'number', min: 10, max: 80 },
  { id: 'rightArm', label: 'Right Arm', unit: 'cm', type: 'number', min: 10, max: 80 },
  { id: 'leftForearm', label: 'Left Forearm', unit: 'cm', type: 'number', min: 10, max: 60 },
  { id: 'rightForearm', label: 'Right Forearm', unit: 'cm', type: 'number', min: 10, max: 60 },
  { id: 'leftThigh', label: 'Left Thigh', unit: 'cm', type: 'number', min: 20, max: 120 },
  { id: 'rightThigh', label: 'Right Thigh', unit: 'cm', type: 'number', min: 20, max: 120 },
  { id: 'leftCalf', label: 'Left Calf', unit: 'cm', type: 'number', min: 15, max: 80 },
  { id: 'rightCalf', label: 'Right Calf', unit: 'cm', type: 'number', min: 15, max: 80 }
];

const DEFAULT_BODY_STATE = {
  version: BODY_STORAGE_VERSION,
  measurements: {},
  updatedAt: null,
  history: []
};

let bodyState = loadBodyState();
let bodyEditing = false;

/* =========================================
   INTERNAL HELPERS
   ========================================= */

function getTodayDateString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTimestamp(iso) {
  if (!iso) return 'Not logged yet';
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return 'Not logged yet';
    return date.toLocaleString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  } catch (err) {
    return 'Not logged yet';
  }
}

function getField(id) {
  return BODY_FIELDS.find((field) => field.id === id) || null;
}

function round(value, decimals = 1) {
  const factor = Math.pow(10, decimals);
  return Math.round(Number(value) * factor) / factor;
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function notify(message) {
  if (typeof window.showToast === 'function') window.showToast(message);
}

/* =========================================
   STORAGE & STATE
   ========================================= */

function loadBodyState() {
  try {
    const raw = localStorage.getItem(BODY_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_BODY_STATE };
    const parsed = JSON.parse(raw);
    return {
      version: parsed.version || BODY_STORAGE_VERSION,
      measurements: parsed.measurements && typeof parsed.measurements === 'object' ? parsed.measurements : {},
      updatedAt: parsed.updatedAt || null,
      history: Array.isArray(parsed.history) ? parsed.history : []
    };
  } catch (err) {
    console.warn('[ASCEND Body] Failed to load state:', err);
    return { ...DEFAULT_BODY_STATE };
  }
}

function saveBodyState() {
  try {
    localStorage.setItem(BODY_STORAGE_KEY, JSON.stringify(bodyState));
  } catch (err) {
    console.warn('[ASCEND Body] Failed to save state:', err);
  }
}

/* =========================================
   VALIDATION
   ========================================= */

/**
 * Validates a single field value against its config.
 * @param {Object} field Field config object
 * @param {*} rawValue Raw value from the form
 * @returns {string|null} Error message or null when valid
 */
function validateField(field, rawValue) {
  if (field.type === 'select') {
    return field.options.includes(String(rawValue)) ? null : 'Please select a valid option.';
  }

  if (rawValue === '' || rawValue === null || rawValue === undefined) {
    return field.required ? 'This field is required.' : null;
  }

  const num = Number(rawValue);
  if (!Number.isFinite(num)) return 'Please enter a valid number.';
  if (num < field.min) return `Must be at least ${field.min} ${field.unit}.`;
  if (num > field.max) return `Must be at most ${field.max} ${field.unit}.`;
  return null;
}

function validateAll(values) {
  const errors = {};
  BODY_FIELDS.forEach((field) => {
    const error = validateField(field, values[field.id]);
    if (error) errors[field.id] = error;
  });
  return errors;
}

/* =========================================
   CALCULATIONS
   ========================================= */

/**
 * Calculates BMI from weight (kg) and height (cm).
 * @param {*} weightKg 
 * @param {*} heightCm 
 * @returns {number|null} BMI rounded to 1 decimal
 */
function calculateBMI(weightKg, heightCm) {
  const weight = toNumberOrNull(weightKg);
  const height = toNumberOrNull(heightCm);
  if (weight === null || height === null || weight <= 0 || height <= 0) return null;
  const meters = height / 100;
  return round(weight / (meters * meters));
}

/**
 * Returns a friendly BMI category label with a styling class.
 * @param {number|null} bmi 
 * @returns {Object} { label, className }
 */
function getBMICategory(bmi) {
  if (bmi === null || bmi === undefined) return { label: '—', className: '' };
  if (bmi < 18.5) return { label: 'Underweight', className: 'underweight' };
  if (bmi < 25) return { label: 'Healthy', className: 'healthy' };
  if (bmi < 30) return { label: 'Overweight', className: 'overweight' };
  return { label: 'Obese', className: 'obese' };
}

/**
 * Calculates the healthy weight range for a given height.
 * @param {*} heightCm 
 * @returns {Object|null} { min, max } in kg
 */
function calculateHealthyWeight(heightCm) {
  const height = toNumberOrNull(heightCm);
  if (height === null || height <= 0) return null;
  const meters = height / 100;
  return {
    min: round(18.5 * meters * meters),
    max: round(25 * meters * meters)
  };
}

function getWeightVerdict(weightKg, healthyRange) {
  const weight = toNumberOrNull(weightKg);
  if (weight === null || !healthyRange) return null;
  if (weight < healthyRange.min) {
    const amount = round(healthyRange.min - weight);
    return { status: 'below', amount, text: `Your current weight is ${amount.toFixed(1)} kg below your healthy range.` };
  }
  if (weight > healthyRange.max) {
    const amount = round(weight - healthyRange.max);
    return { status: 'above', amount, text: `Your current weight is ${amount.toFixed(1)} kg above your healthy range.` };
  }
  return { status: 'within', amount: 0, text: 'Your current weight is within your healthy range.' };
}

/* =========================================
   PUBLIC API: DATA
   ========================================= */

/**
 * Public API: getMeasurements()
 * Returns current measurements enriched with all derived values.
 * Future modules should call this instead of reading localStorage directly.
 * @returns {Object} Measurements, derived metrics, and progress summary
 */
function getMeasurements() {
  const measurements = { ...bodyState.measurements };
  const updatedAt = bodyState.updatedAt;

  const weight = toNumberOrNull(measurements.weight);
  const height = toNumberOrNull(measurements.height);

  const bmi = calculateBMI(weight, height);
  const bmiCategory = getBMICategory(bmi);
  const healthyWeight = calculateHealthyWeight(height);
  const weightVerdict = getWeightVerdict(weight, healthyWeight);

  const previous = bodyState.history.length
    ? { ...bodyState.history[bodyState.history.length - 1] }
    : null;

  let weightDiff = null;
  let bmiDiff = null;
  let summaryText = 'This is your first logged entry. Keep tracking to see trends.';

  const prevWeight = previous ? toNumberOrNull(previous.weight) : null;
  if (prevWeight !== null && weight !== null) {
    weightDiff = round(weight - prevWeight);
    if (weightDiff < 0) summaryText = `You have lost ${Math.abs(weightDiff).toFixed(1)} kg since your last update.`;
    else if (weightDiff > 0) summaryText = `You have gained ${weightDiff.toFixed(1)} kg since your last update.`;
    else summaryText = 'Your weight is unchanged since your last update.';
  }

  const prevBMI = previous ? toNumberOrNull(previous.bmi) : null;
  if (prevBMI !== null && bmi !== null) {
    bmiDiff = round(bmi - prevBMI);
  }

  return {
    measurements,
    updatedAt,
    previous,
    bmi,
    bmiCategory,
    healthyWeight,
    weightVerdict,
    summary: {
      currentWeight: weight,
      previousWeight: prevWeight,
      weightDiff,
      bmiDiff,
      text: summaryText
    }
  };
}

/**
 * Public API: loadMeasurements()
 * Returns the raw persisted state for the body module.
 * @returns {Object} { version, measurements, updatedAt, history }
 */
function loadMeasurements() {
  return JSON.parse(JSON.stringify(bodyState));
}

/**
 * Public API: saveMeasurements(values)
 * Validates and persists a full set of measurement values.
 * @param {Object} values Map of field id -> raw input value
 * @returns {Object} { success, errors, state }
 */
function saveMeasurements(values) {
  const errors = validateAll(values || {});
  if (Object.keys(errors).length) {
    return { success: false, errors, state: getMeasurements() };
  }

  const prevWeight = toNumberOrNull(bodyState.measurements.weight);
  const prevBMI = calculateBMI(bodyState.measurements.weight, bodyState.measurements.height);

  if (prevWeight !== null) {
    bodyState.history.push({
      date: getTodayDateString(),
      weight: prevWeight,
      bmi: prevBMI
    });
    if (bodyState.history.length > BODY_HISTORY_LIMIT) {
      bodyState.history.splice(0, bodyState.history.length - BODY_HISTORY_LIMIT);
    }
  }

  const next = {};
  BODY_FIELDS.forEach((field) => {
    const raw = values[field.id];
    next[field.id] = field.type === 'select'
      ? String(raw)
      : toNumberOrNull(raw);
  });

  bodyState.measurements = next;
  bodyState.updatedAt = new Date().toISOString();
  saveBodyState();
  bodyEditing = false;
  render();
  notify('Measurements saved.');

  return { success: true, errors: {}, state: getMeasurements() };
}

/**
 * Public API: reset()
 * Clears all body measurement data for this module.
 * @returns {boolean} Always true
 */
function reset() {
  try {
    localStorage.removeItem(BODY_STORAGE_KEY);
  } catch (err) {
    console.warn('[ASCEND Body] Failed to reset state:', err);
  }
  bodyState = { ...DEFAULT_BODY_STATE };
  bodyEditing = false;
  render();
  notify('Body measurements reset.');
  return true;
}

/* =========================================
   RENDERING
   ========================================= */

function renderFieldInput(field, value) {
  const base = `body-input ${field.unit ? 'body-input-with-unit' : ''}`;

  if (field.type === 'select') {
    const options = field.options
      .map((option) => `<option value="${escapeHtml(option)}"${String(value) === option ? ' selected' : ''}>${escapeHtml(option)}</option>`)
      .join('');
    return `
      <label class="body-item-label" for="body-input-${field.id}">${field.label}${field.required ? ' *' : ''}</label>
      <select id="body-input-${field.id}" name="${field.id}" class="${base}">${options}</select>
      <span class="body-error" data-error-for="${field.id}" role="alert"></span>`;
  }

  const hasValue = value !== null && value !== undefined && value !== '';
  return `
    <label class="body-item-label" for="body-input-${field.id}">${field.label}${field.required ? ' *' : ''}</label>
    <div class="body-input-wrap">
      <input id="body-input-${field.id}" name="${field.id}" type="number" inputmode="decimal" step="0.1" min="${field.min}" max="${field.max}" class="${base}" value="${hasValue ? escapeHtml(value) : ''}" placeholder="—" />
      ${field.unit ? `<span class="body-unit">${escapeHtml(field.unit)}</span>` : ''}
    </div>
    <span class="body-error" data-error-for="${field.id}" role="alert"></span>`;
}

function renderEditForm() {
  const fields = BODY_FIELDS.map((field) => {
    const value = bodyState.measurements[field.id];
    return `<div class="body-item is-edit">${renderFieldInput(field, value)}</div>`;
  }).join('');

  return `
    <form class="body-form" id="bodyForm" novalidate>
      <div class="body-grid">${fields}</div>
      <div class="body-form-actions">
        <button type="submit" class="gen-submit body-save">Save Measurements</button>
        <button type="button" class="tool-btn" data-body-action="cancel">Cancel</button>
      </div>
    </form>`;
}

function renderEmptyState() {
  return `
    <div class="body-empty dash-card">
      <div class="body-empty-icon">01</div>
      <h3 class="achievements-title">No measurements yet</h3>
      <p class="body-empty-desc">Log your body metrics once to unlock BMI, your healthy weight range, and automatic progress tracking.</p>
      <button type="button" class="tool-btn" data-body-action="edit">Start Tracking</button>
    </div>`;
}

function renderSummary(data) {
  const updated = formatTimestamp(data.updatedAt);
  const category = data.bmiCategory;
  const verdict = data.weightVerdict;
  const healthy = data.healthyWeight;

  const currentWeight = data.summary.currentWeight;
  const previousWeight = data.summary.previousWeight;
  const weightDiff = data.summary.weightDiff;
  const bmiDiff = data.summary.bmiDiff;

  const weightDiffDisplay = weightDiff === null
    ? '—'
    : `${weightDiff > 0 ? '+' : ''}${weightDiff.toFixed(1)} kg`;
  const weightDiffClass = weightDiff === null
    ? 'val'
    : (weightDiff < 0 ? 'val green' : 'val');
  const weightDiffNote = weightDiff === null
    ? 'Log two entries to track'
    : (weightDiff < 0 ? 'Lost since last update' : (weightDiff > 0 ? 'Gained since last update' : 'Unchanged since last update'));

  const bmiDiffDisplay = bmiDiff === null
    ? '—'
    : `${bmiDiff > 0 ? '+' : ''}${bmiDiff.toFixed(1)} vs last log`;

  const healthyRange = healthy ? `${healthy.min.toFixed(1)} – ${healthy.max.toFixed(1)} kg` : '—';
  const bmiDisplay = data.bmi === null ? '—' : data.bmi.toFixed(1);

  return `
    <div class="body-summary">
      <div class="dash-card body-stat">
        <span class="label">Current Weight</span>
        <div class="val">${currentWeight === null ? '—' : currentWeight.toFixed(1) + ' kg'}</div>
        <span class="delta body-delta-muted">Updated ${updated}</span>
      </div>
      <div class="dash-card body-stat">
        <span class="label">Previous Weight</span>
        <div class="val">${previousWeight === null ? '—' : previousWeight.toFixed(1) + ' kg'}</div>
        <span class="delta body-delta-muted">From your last log</span>
      </div>
      <div class="dash-card body-stat">
        <span class="label">Weight Difference</span>
        <div class="${weightDiffClass}">${weightDiffDisplay}</div>
        <span class="delta body-delta-muted">${weightDiffNote}</span>
      </div>
      <div class="dash-card body-stat">
        <span class="label">BMI</span>
        <div class="val">${bmiDisplay}</div>
        <span class="body-badge ${category.className}">${category.label}</span>
      </div>
    </div>

    <div class="body-summary-secondary">
      <div class="dash-card body-card-wide">
        <div class="body-card-head">
          <div>
            <span class="label">Healthy Weight Range</span>
            <div class="body-card-value">${healthyRange}</div>
          </div>
          <div>
            <span class="label">BMI Difference</span>
            <div class="body-card-value">${bmiDiffDisplay}</div>
          </div>
        </div>
        <p class="body-verdict">${verdict ? verdict.text : 'Log your height and weight to unlock healthy range insights.'}</p>
        <p class="body-summary-text">${data.summary.text}</p>
        <span class="body-updated">Last updated: ${updated}</span>
      </div>
      <div class="dash-card body-card-actions">
        <button type="button" class="tool-btn" data-body-action="edit">Edit Measurements</button>
        <button type="button" class="tool-btn body-reset" data-body-action="reset">Reset All</button>
      </div>
    </div>`;
}

function renderGrid() {
  const updated = formatTimestamp(bodyState.updatedAt);
  const items = BODY_FIELDS.map((field) => {
    const value = bodyState.measurements[field.id];
    const display = field.type === 'select'
      ? escapeHtml(value || '—')
      : (value === null || value === undefined || value === '' ? '—' : `${Number(value)} ${field.unit}`);
    return `
      <div class="body-item">
        <div class="body-item-head">
          <span class="body-item-label">${field.label}</span>
          <span class="body-item-value">${display}</span>
        </div>
        <span class="body-item-time">Updated ${updated}</span>
      </div>`;
  }).join('');
  return `<div class="body-grid">${items}</div>`;
}

/**
 * Public API: render()
 * Re-renders the whole body measurements shell based on current state.
 */
function render() {
  const container = document.getElementById('bodyShell');
  if (!container) return;

  if (bodyEditing) {
    container.innerHTML = renderEditForm();
    bindFormEvents(container);
    return;
  }

  const data = getMeasurements();
  const hasData = Object.keys(data.measurements).length > 0;
  container.innerHTML = hasData ? renderSummary(data) + renderGrid() : renderEmptyState();
}

/* =========================================
   EVENTS
   ========================================= */

function handleAction(action) {
  if (action === 'edit') {
    bodyEditing = true;
    render();
  } else if (action === 'cancel') {
    bodyEditing = false;
    render();
  } else if (action === 'reset') {
    if (window.confirm('Reset all body measurements? This cannot be undone.')) reset();
  }
}

function bindFormEvents(container) {
  const form = container.querySelector('#bodyForm');
  if (!form) return;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = {};
    BODY_FIELDS.forEach((field) => {
      const input = form.querySelector(`[name="${field.id}"]`);
      values[field.id] = input ? input.value : '';
    });
    const result = saveMeasurements(values);
    if (!result.success) showFieldErrors(form, result.errors);
  });

  form.addEventListener('input', (event) => {
    const input = event.target;
    if (!input || !input.name) return;
    input.classList.remove('invalid');
    const errorEl = form.querySelector(`[data-error-for="${input.name}"]`);
    if (errorEl) errorEl.textContent = '';
  });
}

function showFieldErrors(form, errors) {
  BODY_FIELDS.forEach((field) => {
    const input = form.querySelector(`[name="${field.id}"]`);
    const errorEl = form.querySelector(`[data-error-for="${field.id}"]`);
    if (input) input.classList.toggle('invalid', Boolean(errors[field.id]));
    if (errorEl) errorEl.textContent = errors[field.id] || '';
  });
}

/* =========================================
   INIT
   ========================================= */

/**
 * Public API: initialize()
 * Binds a single delegated click listener and performs the initial render.
 */
function initialize() {
  const container = document.getElementById('bodyShell');
  if (!container) return;

  // Single delegated listener — safe across re-renders (no listener buildup)
  container.addEventListener('click', (event) => {
    const button = event.target.closest('[data-body-action]');
    if (button) handleAction(button.getAttribute('data-body-action'));
  });

  render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

/* =========================================
   PUBLIC API EXPORT
   ========================================= */

window.ASCEND_BODY = {
  initialize,
  saveMeasurements,
  loadMeasurements,
  getMeasurements,
  calculateBMI,
  calculateHealthyWeight,
  render,
  reset,
  getFields: () => BODY_FIELDS.map((field) => ({ ...field })),
  getHistory: () => bodyState.history.map((entry) => ({ ...entry }))
};
