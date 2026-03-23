// ============================================================
// KBA Movers — Estimate Calculator
// All proposed rates from pricing sheet + new surcharges
// ============================================================

const PRICING = {
  'movers-truck': {
    1: { base: 285, addlHr: 90,  travel: 100 },
    2: { base: 420, addlHr: 175, travel: 185 },
    3: { base: 625, addlHr: 265, travel: 260 },
    4: { base: 825, addlHr: 350, travel: 365 },
  },
  'labor-only': {
    2: { base: 420, addlHr: 165, travel: 0 },
    3: { base: 520, addlHr: 215, travel: 0 },
    4: { base: 650, addlHr: 295, travel: 0 },
  },
};

const SCHEDULE_SURCHARGES = {
  'same-day':  0.20,
  'next-day':  0.10,
  'standard':  0.00,
};

const DAY_SURCHARGES = {
  'weekday':  0.00,
  'weekend':  0.15,
  'holiday':  0.25,
};

const SPECIALTY = {
  piano: { flat: 175, stairs: 300 },
  med1:  { flat: 50,  stairs: 75  },   // 300-450 lbs
  med2:  { flat: 275, stairs: 400 },   // 450-600 lbs
  heavy: { flat: 600, stairs: 750 },   // 600+ lbs
};

const LONG_CARRY = {
  'none': 0,
  '75':   50,   // 75-150 ft
  '150':  75,   // 150+ ft
};

const PACKING_MATERIALS = {
  'small':  75,
  'medium': 125,
  'large':  150,
};

const CANCEL_FEES = {
  'none':   0,
  'late':   100,  // <24hr cancel
  'noshow': 150,  // no-show
};

const STAIR_FEE       = 50;    // per flight after 1st
const FUEL_PER_MILE   = 2.00;  // per mile beyond 30-mi radius
const PACK_LABOR_RATE = 50;    // per hour per packer
const HAH_FEE         = 0.29;
const MIN_HOURS       = 2;

// ---- State ----
const state = {
  jobType:       'movers-truck',
  crew:          2,
  hours:         2,
  schedule:      'standard',
  dayType:       'weekday',
  longCarry:     'none',
  extraMiles:    0,
  stairsPickup:  0,
  stairsDropoff: 0,
  piano:         0, pianoStairs:  false,
  med1:          0, med1Stairs:   false,
  med2:          0, med2Stairs:   false,
  heavy:         0, heavyStairs:  false,
  packingMaterials: false,
  packingSize:   'small',
  packLaborHrs:  0,
  cancelFee:     'none',
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
  recalculate();

  document.addEventListener('change', recalculate);
});

// ---- Job Type Toggle ----
function bindJobType() {
  $$('[data-job]').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('[data-job]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.jobType = btn.dataset.job;
      if (!PRICING[state.jobType][state.crew]) {
        state.crew = Number(Object.keys(PRICING[state.jobType])[0]);
      }
      renderCrewOptions();
      recalculate();
    });
  });
}

// ---- Crew Options ----
function renderCrewOptions() {
  const container = $('#crewOptions');
  const rates = PRICING[state.jobType];
  container.innerHTML = '';

  Object.entries(rates).forEach(([size, r]) => {
    const btn = document.createElement('button');
    btn.className = 'crew-btn' + (Number(size) === state.crew ? ' active' : '');
    btn.innerHTML = `
      <div class="crew-size">${size}-Person</div>
      <div class="crew-price">Base: $${r.base}</div>
    `;
    btn.addEventListener('click', () => {
      state.crew = Number(size);
      container.querySelectorAll('.crew-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      recalculate();
    });
    container.appendChild(btn);
  });
}

// ---- Schedule Toggle ----
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

// ---- Day Type Toggle ----
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

// ---- Long Carry Toggle ----
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

// ---- Packing Materials Toggle ----
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

// ---- Cancel Fee Toggle ----
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

// ---- Steppers ----
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
      if (state[s.key] < s.max) {
        state[s.key]++;
        $(`#${s.value}`).textContent = state[s.key];
        recalculate();
      }
    });
    $(`#${s.down}`).addEventListener('click', () => {
      if (state[s.key] > s.min) {
        state[s.key]--;
        $(`#${s.value}`).textContent = state[s.key];
        recalculate();
      }
    });
  });
}

// ---- Checkboxes ----
function bindCheckboxes() {
  ['piano', 'med1', 'med2', 'heavy'].forEach(key => {
    $(`#${key}Stairs`).addEventListener('change', (e) => {
      state[`${key}Stairs`] = e.target.checked;
      recalculate();
    });
  });
}

// ---- Recalculate ----
function recalculate() {
  const rates = PRICING[state.jobType][state.crew];
  if (!rates) return;

  const lines = [];
  let subtotal = 0;

  // Base rate (2-hr minimum)
  lines.push({ label: `${state.crew}-Person Crew — Base (${MIN_HOURS} hrs)`, amount: rates.base });
  subtotal += rates.base;

  // Additional hours
  const extraHours = Math.max(0, state.hours - MIN_HOURS);
  if (extraHours > 0) {
    const addl = extraHours * rates.addlHr;
    lines.push({ label: `Additional ${extraHours} hr${extraHours > 1 ? 's' : ''} @ $${rates.addlHr}/hr`, amount: addl });
    subtotal += addl;
  }

  // Travel fee
  if (rates.travel > 0) {
    lines.push({ label: 'Flat Travel Fee', amount: rates.travel });
    subtotal += rates.travel;
  }

  // Long carry
  const carryCost = LONG_CARRY[state.longCarry];
  if (carryCost > 0) {
    const carryLabel = state.longCarry === '75' ? 'Long Carry (75–150 ft)' : 'Long Carry (150+ ft)';
    lines.push({ label: carryLabel, amount: carryCost });
    subtotal += carryCost;
  }

  // Extra mileage
  if (state.extraMiles > 0) {
    const mileageCost = state.extraMiles * FUEL_PER_MILE;
    lines.push({ label: `Fuel Surcharge — ${state.extraMiles} extra mi @ $${FUEL_PER_MILE.toFixed(2)}/mi`, amount: mileageCost });
    subtotal += mileageCost;
  }

  // Stairs
  const totalFlights = state.stairsPickup + state.stairsDropoff;
  if (totalFlights > 0) {
    const stairCost = totalFlights * STAIR_FEE;
    lines.push({ label: `Stairs — ${totalFlights} extra flight${totalFlights > 1 ? 's' : ''} @ $${STAIR_FEE}`, amount: stairCost });
    subtotal += stairCost;
  }

  // Specialty items
  const specialtyItems = [
    { key: 'piano', label: 'Upright Piano' },
    { key: 'med1',  label: 'Item 300–450 lbs' },
    { key: 'med2',  label: 'Item 450–600 lbs' },
    { key: 'heavy', label: 'Item 600+ lbs' },
  ];

  specialtyItems.forEach(item => {
    const qty = state[item.key];
    if (qty > 0) {
      const withStairs = state[`${item.key}Stairs`];
      const unitPrice = withStairs ? SPECIALTY[item.key].stairs : SPECIALTY[item.key].flat;
      const total = qty * unitPrice;
      const stairsNote = withStairs ? ' (w/ stairs)' : '';
      const qtyNote = qty > 1 ? ` x${qty}` : '';
      lines.push({ label: `${item.label}${stairsNote}${qtyNote}`, amount: total });
      subtotal += total;
    }
  });

  // Packing materials
  if (state.packingMaterials) {
    const matCost = PACKING_MATERIALS[state.packingSize];
    lines.push({ label: `Packing Materials (${state.packingSize})`, amount: matCost });
    subtotal += matCost;
  }

  // Packing labor
  if (state.packLaborHrs > 0) {
    const packCost = state.packLaborHrs * PACK_LABOR_RATE;
    lines.push({ label: `Packing Labor — ${state.packLaborHrs} hr${state.packLaborHrs > 1 ? 's' : ''} @ $${PACK_LABOR_RATE}/hr`, amount: packCost });
    subtotal += packCost;
  }

  // Cancellation fee (flat, not affected by percentage surcharges)
  const cancelAmount = CANCEL_FEES[state.cancelFee];

  // Scheduling surcharge (percentage on subtotal)
  const scheduleRate = SCHEDULE_SURCHARGES[state.schedule];
  let scheduleSurcharge = 0;
  if (scheduleRate > 0) {
    scheduleSurcharge = Math.round(subtotal * scheduleRate * 100) / 100;
    const label = state.schedule === 'same-day' ? 'Same-Day Surcharge (20%)' : 'Next-Day Surcharge (10%)';
    lines.push({ label, amount: scheduleSurcharge });
  }

  // Weekend / holiday surcharge (percentage on subtotal)
  const dayRate = DAY_SURCHARGES[state.dayType];
  let daySurcharge = 0;
  if (dayRate > 0) {
    daySurcharge = Math.round(subtotal * dayRate * 100) / 100;
    const label = state.dayType === 'weekend' ? 'Weekend Premium (15%)' : 'Holiday Premium (25%)';
    lines.push({ label, amount: daySurcharge });
  }

  // Cancel fee line (after percentages)
  if (cancelAmount > 0) {
    const cancelLabel = state.cancelFee === 'late' ? 'Late Cancellation Fee (<24 hrs)' : 'No-Show Fee';
    lines.push({ label: cancelLabel, amount: cancelAmount });
  }

  const grandTotal = subtotal + scheduleSurcharge + daySurcharge + cancelAmount;
  const netAfterFee = Math.round(grandTotal * (1 - HAH_FEE) * 100) / 100;

  // Render
  const summaryBody = $('#summaryBody');
  summaryBody.innerHTML = lines.map(l =>
    `<div class="summary-line">
      <span>${l.label}</span>
      <span>$${l.amount.toFixed(2)}</span>
    </div>`
  ).join('');

  $('#totalAmount').textContent = `$${grandTotal.toFixed(2)}`;
  $('#netAmount').textContent = `$${netAfterFee.toFixed(2)}`;
}

// ---- Actions ----
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

  const jobLabel = state.jobType === 'movers-truck' ? 'Movers + Truck' : 'Labor Only';
  lines.push(`Service: ${jobLabel} — ${state.crew}-Person Crew`);
  lines.push(`Hours: ${state.hours} (2-hr minimum)`);
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
