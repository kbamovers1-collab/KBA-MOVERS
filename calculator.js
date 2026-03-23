// ============================================================
// KBA Movers — Estimate Calculator
// Local + Long Distance pricing
// USDOT #4420459 | MC #1737835
// ============================================================

// ---- LOCAL PRICING ----
const PRICING = {
  'movers-truck': {
    1: { base: 285, addlHr: 90,  travel: 100 },
    2: { base: 420, addlHr: 175, travel: 185 },
    3: { base: 625, addlHr: 265, travel: 260 },
    4: { base: 825, addlHr: 350, travel: 365 },
  },
  'labor-only': {
    2: { base: 625, addlHr: 220, travel: 0 },
    3: { base: 735, addlHr: 275, travel: 0 },
    4: { base: 845, addlHr: 495, travel: 0 },
  },
};

// ---- LONG DISTANCE PRICING ----
// Per-pound rate by distance tier (competitive independent pricing, 20-30% below van lines)
const LD_RATE_TABLE = {
  // distance tier: { minMiles, maxMiles, rates by weight bracket }
  // Weight brackets: under 3000, 3000-5000, 5000-8000, 8000-12000, 12000+
  tier1: { min: 50,   max: 150,  label: '50–150 mi',    rates: [0.85, 0.65, 0.50, 0.40, 0.35] },
  tier2: { min: 151,  max: 300,  label: '151–300 mi',   rates: [0.80, 0.60, 0.48, 0.38, 0.33] },
  tier3: { min: 301,  max: 500,  label: '301–500 mi',   rates: [0.75, 0.55, 0.45, 0.36, 0.31] },
  tier4: { min: 501,  max: 1000, label: '501–1,000 mi', rates: [0.70, 0.50, 0.42, 0.34, 0.29] },
  tier5: { min: 1001, max: 9999, label: '1,000+ mi',    rates: [0.65, 0.48, 0.40, 0.32, 0.27] },
};

const LD_WEIGHT_BRACKETS = [
  { max: 3000,  label: 'Under 3,000 lbs', index: 0 },
  { max: 5000,  label: '3,000–5,000 lbs', index: 1 },
  { max: 8000,  label: '5,000–8,000 lbs', index: 2 },
  { max: 12000, label: '8,000–12,000 lbs', index: 3 },
  { max: 99999, label: '12,000+ lbs',      index: 4 },
];

const LD_CREW_RATES = {
  2: { daily: 800 },
  3: { daily: 1100 },
  4: { daily: 1400 },
};

const LD_HOME_DEFAULTS = {
  'studio': { weight: 2500, label: 'Studio' },
  '1br':    { weight: 3500, label: '1 Bedroom' },
  '2br':    { weight: 5500, label: '2 Bedroom' },
  '3br':    { weight: 8000, label: '3 Bedroom' },
  '4br':    { weight: 12000, label: '4+ Bedroom' },
};

const LD_PACKING_MATERIALS = { 'studio': 200, '1br': 200, '2br': 350, '3br': 500, '4br': 500 };
const LD_FUEL_SURCHARGE   = 0.08;   // 8% of line-haul
const LD_MIN_WEIGHT       = 2000;
const LD_SHUTTLE_FEE      = 300;
const LD_STORAGE_MONTHLY  = 150;
const LD_OVERNIGHT_RATE   = 175;
const LD_PACKING_HOURLY   = 60;
const LD_INSURANCE_RATE   = 0.015;  // 1.5% of declared value

// ---- LOCAL SURCHARGES ----
const SCHEDULE_SURCHARGES = { 'same-day': 0.20, 'next-day': 0.10, 'standard': 0.00 };
const DAY_SURCHARGES = { 'weekday': 0.00, 'weekend': 0.15, 'holiday': 0.25 };

const SPECIALTY = {
  piano: { flat: 175, stairs: 300 },
  med1:  { flat: 50,  stairs: 75  },
  med2:  { flat: 275, stairs: 400 },
  heavy: { flat: 600, stairs: 750 },
};

const LONG_CARRY    = { 'none': 0, '75': 50, '150': 75 };
const PACKING_MATERIALS = { 'small': 75, 'medium': 125, 'large': 150 };
const CANCEL_FEES   = { 'none': 0, 'late': 100, 'noshow': 150 };

const STAIR_FEE       = 50;
const FUEL_PER_MILE   = 2.00;
const PACK_LABOR_RATE = 50;
const HAH_FEE         = 0.29;
const MIN_HOURS       = 2;

// ---- State ----
const state = {
  // Job type
  jobType: 'movers-truck',

  // Local state
  crew: 2, hours: 2, schedule: 'standard', dayType: 'weekday',
  longCarry: 'none', extraMiles: 0,
  stairsPickup: 0, stairsDropoff: 0,
  piano: 0, pianoStairs: false,
  med1: 0, med1Stairs: false,
  med2: 0, med2Stairs: false,
  heavy: 0, heavyStairs: false,
  packingMaterials: false, packingSize: 'small',
  packLaborHrs: 0, cancelFee: 'none',

  // Long distance state
  ldHomeSize: 'studio', ldMiles: 100, ldWeight: 2500, ldCrew: 2,
  ldFullPacking: false, ldPackHrs: 0,
  ldPackingMaterials: false,
  ldStorage: false, ldStorageMonths: 1,
  ldShuttle: false,
  ldOvernight: false, ldNights: 1,
  ldInsurance: 'basic', ldDeclaredValue: 25000,
};

// ---- DOM refs ----
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  renderCrewOptions();
  bindJobType();
  bindSchedule();
  bindDayType();
  bindLongCarry();
  bindPackingMaterials();
  bindPackingSize();
  bindCancelFee();
  bindSteppers();
  bindCheckboxes();
  bindActions();

  // Long distance bindings
  bindHomeSize();
  bindLdCrew();
  bindLdAddons();
  bindLdInsurance();
  bindLdSteppers();
  updateLdDistanceTag();
  updateLdWeightHint();

  recalculate();
  document.addEventListener('change', recalculate);
});

// ============================================================
// SECTION VISIBILITY
// ============================================================
function updateSections() {
  const isLD = state.jobType === 'long-distance';
  $('#localSection').style.display = isLD ? 'none' : '';
  $('#longDistanceSection').style.display = isLD ? '' : 'none';
}

// ============================================================
// JOB TYPE
// ============================================================
function bindJobType() {
  $$('[data-job]').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('[data-job]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.jobType = btn.dataset.job;

      if (state.jobType !== 'long-distance') {
        if (!PRICING[state.jobType][state.crew]) {
          state.crew = Number(Object.keys(PRICING[state.jobType])[0]);
        }
        renderCrewOptions();
      }
      updateSections();
      recalculate();
    });
  });
}

// ============================================================
// LOCAL MOVE CONTROLS
// ============================================================
function renderCrewOptions() {
  const container = $('#crewOptions');
  const rates = PRICING[state.jobType];
  if (!rates) return;
  container.innerHTML = '';

  Object.entries(rates).forEach(([size, r]) => {
    const btn = document.createElement('button');
    btn.className = 'crew-btn' + (Number(size) === state.crew ? ' active' : '');
    btn.innerHTML = `<div class="crew-size">${size}-Person</div><div class="crew-price">Base: $${r.base}</div>`;
    btn.addEventListener('click', () => {
      state.crew = Number(size);
      container.querySelectorAll('.crew-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      recalculate();
    });
    container.appendChild(btn);
  });
}

function bindSchedule() {
  $$('.schedule-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.schedule-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.schedule = btn.dataset.schedule;
      recalculate();
    });
  });
}

function bindDayType() {
  $$('.day-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.day-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.dayType = btn.dataset.day;
      recalculate();
    });
  });
}

function bindLongCarry() {
  $$('.carry-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.carry-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.longCarry = btn.dataset.carry;
      recalculate();
    });
  });
}

function bindPackingMaterials() {
  $('#packingMaterials').addEventListener('change', (e) => {
    state.packingMaterials = e.target.checked;
    $('#packingSizeGroup').style.display = e.target.checked ? 'flex' : 'none';
    recalculate();
  });
}

function bindPackingSize() {
  $$('.packing-size-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.packing-size-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.packingSize = btn.dataset.packsize;
      recalculate();
    });
  });
}

function bindCancelFee() {
  $$('.cancel-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.cancel-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.cancelFee = btn.dataset.cancel;
      recalculate();
    });
  });
}

function bindSteppers() {
  const steppers = [
    { up: 'hoursUp',         down: 'hoursDown',         value: 'hoursValue',         key: 'hours',         min: MIN_HOURS, max: 16 },
    { up: 'milesUp',         down: 'milesDown',         value: 'milesValue',         key: 'extraMiles',    min: 0, max: 200 },
    { up: 'stairsPickupUp',  down: 'stairsPickupDown',  value: 'stairsPickupValue',  key: 'stairsPickup',  min: 0, max: 10 },
    { up: 'stairsDropoffUp', down: 'stairsDropoffDown', value: 'stairsDropoffValue', key: 'stairsDropoff', min: 0, max: 10 },
    { up: 'pianoUp',         down: 'pianoDown',         value: 'pianoValue',         key: 'piano',         min: 0, max: 5 },
    { up: 'med1Up',          down: 'med1Down',          value: 'med1Value',          key: 'med1',          min: 0, max: 10 },
    { up: 'med2Up',          down: 'med2Down',          value: 'med2Value',          key: 'med2',          min: 0, max: 10 },
    { up: 'heavyUp',         down: 'heavyDown',         value: 'heavyValue',         key: 'heavy',         min: 0, max: 10 },
    { up: 'packLaborUp',     down: 'packLaborDown',     value: 'packLaborValue',     key: 'packLaborHrs',  min: 0, max: 20 },
  ];

  steppers.forEach(s => {
    $(`#${s.up}`).addEventListener('click', () => {
      if (state[s.key] < s.max) { state[s.key]++; $(`#${s.value}`).textContent = state[s.key]; recalculate(); }
    });
    $(`#${s.down}`).addEventListener('click', () => {
      if (state[s.key] > s.min) { state[s.key]--; $(`#${s.value}`).textContent = state[s.key]; recalculate(); }
    });
  });
}

function bindCheckboxes() {
  ['piano', 'med1', 'med2', 'heavy'].forEach(key => {
    $(`#${key}Stairs`).addEventListener('change', (e) => {
      state[`${key}Stairs`] = e.target.checked;
      recalculate();
    });
  });
}

// ============================================================
// LONG DISTANCE CONTROLS
// ============================================================
function bindHomeSize() {
  $$('.home-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.home-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.ldHomeSize = btn.dataset.home;
      // Auto-set weight to default for home size
      state.ldWeight = LD_HOME_DEFAULTS[state.ldHomeSize].weight;
      $('#ldWeightValue').textContent = state.ldWeight;
      updateLdWeightHint();
      recalculate();
    });
  });
}

function bindLdCrew() {
  $$('.ld-crew-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.ld-crew-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.ldCrew = Number(btn.dataset.ldcrew);
      recalculate();
    });
  });
}

function bindLdAddons() {
  $('#ldFullPacking').addEventListener('change', (e) => {
    state.ldFullPacking = e.target.checked;
    $('#ldPackingHoursGroup').style.display = e.target.checked ? '' : 'none';
    if (e.target.checked && state.ldPackHrs === 0) {
      state.ldPackHrs = 4;
      $('#ldPackHrsValue').textContent = 4;
    }
    recalculate();
  });

  $('#ldPackingMaterials').addEventListener('change', (e) => {
    state.ldPackingMaterials = e.target.checked;
    recalculate();
  });

  $('#ldStorage').addEventListener('change', (e) => {
    state.ldStorage = e.target.checked;
    $('#ldStorageMonthsGroup').style.display = e.target.checked ? '' : 'none';
    recalculate();
  });

  $('#ldShuttle').addEventListener('change', (e) => {
    state.ldShuttle = e.target.checked;
    recalculate();
  });

  $('#ldOvernight').addEventListener('change', (e) => {
    state.ldOvernight = e.target.checked;
    $('#ldOvernightGroup').style.display = e.target.checked ? '' : 'none';
    recalculate();
  });
}

function bindLdInsurance() {
  $$('.insurance-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.insurance-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.ldInsurance = btn.dataset.insurance;
      $('#ldDeclaredGroup').style.display = state.ldInsurance === 'full' ? '' : 'none';
      recalculate();
    });
  });

  $('#ldDeclaredValue').addEventListener('input', (e) => {
    state.ldDeclaredValue = Number(e.target.value) || 0;
    recalculate();
  });
}

function bindLdSteppers() {
  // Miles steppers (±1 and ±10)
  const mileStepper = (id, delta) => {
    $(id).addEventListener('click', () => {
      state.ldMiles = Math.max(50, Math.min(3000, state.ldMiles + delta));
      $('#ldMilesValue').textContent = state.ldMiles;
      updateLdDistanceTag();
      recalculate();
    });
  };
  mileStepper('#ldMilesUp', 1);
  mileStepper('#ldMilesDown', -1);
  mileStepper('#ldMilesUp10', 10);
  mileStepper('#ldMilesDown10', -10);

  // Weight steppers (±100 and ±500)
  const weightStepper = (id, delta) => {
    $(id).addEventListener('click', () => {
      state.ldWeight = Math.max(LD_MIN_WEIGHT, Math.min(30000, state.ldWeight + delta));
      $('#ldWeightValue').textContent = state.ldWeight;
      updateLdWeightHint();
      recalculate();
    });
  };
  weightStepper('#ldWeightUp', 100);
  weightStepper('#ldWeightDown', -100);
  weightStepper('#ldWeightUp500', 500);
  weightStepper('#ldWeightDown500', -500);

  // Packing hours
  const ldPackStepper = (id, delta) => {
    $(id).addEventListener('click', () => {
      state.ldPackHrs = Math.max(0, Math.min(40, state.ldPackHrs + delta));
      $('#ldPackHrsValue').textContent = state.ldPackHrs;
      recalculate();
    });
  };
  ldPackStepper('#ldPackHrsUp', 1);
  ldPackStepper('#ldPackHrsDown', -1);

  // Storage months
  const ldStorageStepper = (id, delta) => {
    $(id).addEventListener('click', () => {
      state.ldStorageMonths = Math.max(1, Math.min(12, state.ldStorageMonths + delta));
      $('#ldStorageValue').textContent = state.ldStorageMonths;
      recalculate();
    });
  };
  ldStorageStepper('#ldStorageUp', 1);
  ldStorageStepper('#ldStorageDown', -1);

  // Overnight nights
  const ldNightsStepper = (id, delta) => {
    $(id).addEventListener('click', () => {
      state.ldNights = Math.max(1, Math.min(10, state.ldNights + delta));
      $('#ldNightsValue').textContent = state.ldNights;
      recalculate();
    });
  };
  ldNightsStepper('#ldNightsUp', 1);
  ldNightsStepper('#ldNightsDown', -1);
}

function updateLdDistanceTag() {
  const tier = getLdTier(state.ldMiles);
  const tag = $('#ldDistanceTag');
  if (tier) {
    tag.textContent = tier.label;
    tag.style.display = '';
  } else {
    tag.style.display = 'none';
  }
}

function updateLdWeightHint() {
  const hint = $('#ldWeightHint');
  if (state.ldWeight <= 3000) hint.textContent = 'Typical for studio/small 1BR';
  else if (state.ldWeight <= 5000) hint.textContent = 'Typical for 1-2 BR home';
  else if (state.ldWeight <= 8000) hint.textContent = 'Typical for 2-3 BR home';
  else if (state.ldWeight <= 12000) hint.textContent = 'Typical for 3-4 BR home';
  else hint.textContent = 'Typical for 4+ BR / large home';
}

function getLdTier(miles) {
  for (const tier of Object.values(LD_RATE_TABLE)) {
    if (miles >= tier.min && miles <= tier.max) return tier;
  }
  return LD_RATE_TABLE.tier5; // fallback to longest
}

function getLdWeightBracketIndex(weight) {
  for (const bracket of LD_WEIGHT_BRACKETS) {
    if (weight <= bracket.max) return bracket.index;
  }
  return 4;
}

// ============================================================
// RECALCULATE — routes to local or long-distance
// ============================================================
function recalculate() {
  if (state.jobType === 'long-distance') {
    recalculateLongDistance();
  } else {
    recalculateLocal();
  }
}

// ---- LOCAL RECALCULATE ----
function recalculateLocal() {
  const rates = PRICING[state.jobType][state.crew];
  if (!rates) return;

  const lines = [];
  let subtotal = 0;

  lines.push({ label: `${state.crew}-Person Crew — Base (${MIN_HOURS} hrs)`, amount: rates.base });
  subtotal += rates.base;

  const extraHours = Math.max(0, state.hours - MIN_HOURS);
  if (extraHours > 0) {
    const addl = extraHours * rates.addlHr;
    lines.push({ label: `Additional ${extraHours} hr${extraHours > 1 ? 's' : ''} @ $${rates.addlHr}/hr`, amount: addl });
    subtotal += addl;
  }

  if (rates.travel > 0) {
    lines.push({ label: 'Flat Travel Fee', amount: rates.travel });
    subtotal += rates.travel;
  }

  const carryCost = LONG_CARRY[state.longCarry];
  if (carryCost > 0) {
    lines.push({ label: state.longCarry === '75' ? 'Long Carry (75–150 ft)' : 'Long Carry (150+ ft)', amount: carryCost });
    subtotal += carryCost;
  }

  if (state.extraMiles > 0) {
    const mc = state.extraMiles * FUEL_PER_MILE;
    lines.push({ label: `Fuel Surcharge — ${state.extraMiles} extra mi @ $${FUEL_PER_MILE.toFixed(2)}/mi`, amount: mc });
    subtotal += mc;
  }

  const totalFlights = state.stairsPickup + state.stairsDropoff;
  if (totalFlights > 0) {
    const sc = totalFlights * STAIR_FEE;
    lines.push({ label: `Stairs — ${totalFlights} extra flight${totalFlights > 1 ? 's' : ''} @ $${STAIR_FEE}`, amount: sc });
    subtotal += sc;
  }

  [{ key: 'piano', label: 'Upright Piano' }, { key: 'med1', label: 'Item 300–450 lbs' },
   { key: 'med2', label: 'Item 450–600 lbs' }, { key: 'heavy', label: 'Item 600+ lbs' }].forEach(item => {
    const qty = state[item.key];
    if (qty > 0) {
      const ws = state[`${item.key}Stairs`];
      const up = ws ? SPECIALTY[item.key].stairs : SPECIALTY[item.key].flat;
      const t = qty * up;
      lines.push({ label: `${item.label}${ws ? ' (w/ stairs)' : ''}${qty > 1 ? ` x${qty}` : ''}`, amount: t });
      subtotal += t;
    }
  });

  if (state.packingMaterials) {
    const mc = PACKING_MATERIALS[state.packingSize];
    lines.push({ label: `Packing Materials (${state.packingSize})`, amount: mc });
    subtotal += mc;
  }

  if (state.packLaborHrs > 0) {
    const pc = state.packLaborHrs * PACK_LABOR_RATE;
    lines.push({ label: `Packing Labor — ${state.packLaborHrs} hr${state.packLaborHrs > 1 ? 's' : ''} @ $${PACK_LABOR_RATE}/hr`, amount: pc });
    subtotal += pc;
  }

  const cancelAmount = CANCEL_FEES[state.cancelFee];
  const schedRate = SCHEDULE_SURCHARGES[state.schedule];
  let schedSurcharge = 0;
  if (schedRate > 0) {
    schedSurcharge = Math.round(subtotal * schedRate * 100) / 100;
    lines.push({ label: state.schedule === 'same-day' ? 'Same-Day Surcharge (20%)' : 'Next-Day Surcharge (10%)', amount: schedSurcharge });
  }

  const dayRate = DAY_SURCHARGES[state.dayType];
  let daySurcharge = 0;
  if (dayRate > 0) {
    daySurcharge = Math.round(subtotal * dayRate * 100) / 100;
    lines.push({ label: state.dayType === 'weekend' ? 'Weekend Premium (15%)' : 'Holiday Premium (25%)', amount: daySurcharge });
  }

  if (cancelAmount > 0) {
    lines.push({ label: state.cancelFee === 'late' ? 'Late Cancellation Fee (<24 hrs)' : 'No-Show Fee', amount: cancelAmount });
  }

  const grandTotal = subtotal + schedSurcharge + daySurcharge + cancelAmount;
  renderSummary(lines, grandTotal);
}

// ---- LONG DISTANCE RECALCULATE ----
function recalculateLongDistance() {
  const lines = [];
  let subtotal = 0;

  // Line-haul: weight x per-lb rate
  const tier = getLdTier(state.ldMiles);
  const bracketIdx = getLdWeightBracketIndex(state.ldWeight);
  const perLb = tier.rates[bracketIdx];
  const effectiveWeight = Math.max(LD_MIN_WEIGHT, state.ldWeight);
  const lineHaul = Math.round(effectiveWeight * perLb * (state.ldMiles / 100)) ;

  lines.push({ label: `Line-Haul — ${effectiveWeight.toLocaleString()} lbs x $${perLb.toFixed(2)}/lb (${tier.label})`, amount: lineHaul });
  subtotal += lineHaul;

  // Crew labor (loading + unloading days)
  const loadDays = state.ldWeight <= 5000 ? 1 : state.ldWeight <= 12000 ? 1.5 : 2;
  const crewRate = LD_CREW_RATES[state.ldCrew];
  const crewCost = Math.round(crewRate.daily * loadDays);
  lines.push({ label: `${state.ldCrew}-Person Crew — ${loadDays} day${loadDays > 1 ? 's' : ''} load/unload @ $${crewRate.daily}/day`, amount: crewCost });
  subtotal += crewCost;

  // Fuel surcharge (8% of line-haul)
  const fuelSurcharge = Math.round(lineHaul * LD_FUEL_SURCHARGE);
  lines.push({ label: `Fuel Surcharge (8% of line-haul)`, amount: fuelSurcharge });
  subtotal += fuelSurcharge;

  // Full packing service
  if (state.ldFullPacking && state.ldPackHrs > 0) {
    const packCost = state.ldPackHrs * LD_PACKING_HOURLY * state.ldCrew;
    lines.push({ label: `Packing Labor — ${state.ldPackHrs} hrs x ${state.ldCrew} packers @ $${LD_PACKING_HOURLY}/hr`, amount: packCost });
    subtotal += packCost;
  }

  // Packing materials
  if (state.ldPackingMaterials) {
    const matCost = LD_PACKING_MATERIALS[state.ldHomeSize];
    lines.push({ label: `Packing Materials (${LD_HOME_DEFAULTS[state.ldHomeSize].label})`, amount: matCost });
    subtotal += matCost;
  }

  // Storage in transit
  if (state.ldStorage) {
    const storageCost = LD_STORAGE_MONTHLY * state.ldStorageMonths;
    lines.push({ label: `Storage-in-Transit — ${state.ldStorageMonths} month${state.ldStorageMonths > 1 ? 's' : ''} @ $${LD_STORAGE_MONTHLY}/mo`, amount: storageCost });
    subtotal += storageCost;
  }

  // Shuttle service
  if (state.ldShuttle) {
    lines.push({ label: 'Shuttle Service (truck access issue)', amount: LD_SHUTTLE_FEE });
    subtotal += LD_SHUTTLE_FEE;
  }

  // Overnight
  if (state.ldOvernight) {
    const nightsCost = LD_OVERNIGHT_RATE * state.ldNights;
    lines.push({ label: `Driver Overnight — ${state.ldNights} night${state.ldNights > 1 ? 's' : ''} @ $${LD_OVERNIGHT_RATE}/night`, amount: nightsCost });
    subtotal += nightsCost;
  }

  // Insurance
  if (state.ldInsurance === 'full') {
    const insuranceCost = Math.round(state.ldDeclaredValue * LD_INSURANCE_RATE);
    lines.push({ label: `Full Value Protection (1.5% of $${state.ldDeclaredValue.toLocaleString()})`, amount: insuranceCost });
    subtotal += insuranceCost;
  } else {
    lines.push({ label: `Basic Liability ($0.60/lb) — included`, amount: 0 });
  }

  renderSummary(lines, subtotal);
}

// ============================================================
// RENDER SUMMARY
// ============================================================
function renderSummary(lines, grandTotal) {
  const netAfterFee = Math.round(grandTotal * (1 - HAH_FEE) * 100) / 100;

  const summaryBody = $('#summaryBody');
  summaryBody.innerHTML = lines.filter(l => l.amount > 0 || l.label.includes('included')).map(l =>
    `<div class="summary-line">
      <span>${l.label}</span>
      <span>${l.amount > 0 ? '$' + l.amount.toFixed(2) : 'FREE'}</span>
    </div>`
  ).join('');

  $('#totalAmount').textContent = `$${grandTotal.toFixed(2)}`;
  $('#netAmount').textContent = `$${netAfterFee.toFixed(2)}`;
}

// ============================================================
// ACTIONS
// ============================================================
function bindActions() {
  $('#btnCopy').addEventListener('click', copyEstimate);
  $('#btnPrint').addEventListener('click', () => window.print());
}

function copyEstimate() {
  const custName    = $('#custName').value || 'Customer';
  const custPhone   = $('#custPhone').value;
  const custPickup  = $('#custPickup').value;
  const custDropoff = $('#custDropoff').value;
  const custDate    = $('#custDate').value;
  const custNotes   = $('#custNotes').value;

  const lines = [];
  lines.push('=== KBA MOVERS — ESTIMATE ===');
  lines.push(`Date: ${custDate || new Date().toLocaleDateString()}`);
  lines.push('');

  if (custName)    lines.push(`Customer: ${custName}`);
  if (custPhone)   lines.push(`Phone: ${custPhone}`);
  if (custPickup)  lines.push(`Pickup: ${custPickup}`);
  if (custDropoff) lines.push(`Dropoff: ${custDropoff}`);
  if (custNotes)   lines.push(`Notes: ${custNotes}`);
  lines.push('');

  if (state.jobType === 'long-distance') {
    lines.push(`Service: Long Distance Move`);
    lines.push(`Home Size: ${LD_HOME_DEFAULTS[state.ldHomeSize].label}`);
    lines.push(`Distance: ${state.ldMiles} miles`);
    lines.push(`Weight: ${state.ldWeight.toLocaleString()} lbs`);
    lines.push(`Crew: ${state.ldCrew}-Person`);
  } else {
    const jobLabel = state.jobType === 'movers-truck' ? 'Movers + Truck' : 'Labor Only';
    lines.push(`Service: ${jobLabel} — ${state.crew}-Person Crew`);
    lines.push(`Hours: ${state.hours} (2-hr minimum)`);
  }
  lines.push('');

  lines.push('--- Breakdown ---');
  $$('#summaryBody .summary-line').forEach(el => {
    const spans = el.querySelectorAll('span');
    lines.push(`${spans[0].textContent}  ${spans[1].textContent}`);
  });
  lines.push('');
  lines.push(`TOTAL: ${$('#totalAmount').textContent}`);
  lines.push(`Your Net (after HAH): ${$('#netAmount').textContent}`);
  lines.push('');
  lines.push('KBA Movers — West Des Moines, IA');
  lines.push('USDOT #4420459 | MC #1737835');
  lines.push('www.kbamoving.com');

  const text = lines.join('\n');

  navigator.clipboard.writeText(text).then(() => {
    const btn = $('#btnCopy');
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = 'Copy Estimate'; }, 2000);
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    const btn = $('#btnCopy');
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = 'Copy Estimate'; }, 2000);
  });
}
