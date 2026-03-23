// ============================================================
// KBA Movers — Estimate Calculator
// All proposed rates from pricing sheet
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

const SURCHARGES = {
  'same-day':  0.20,
  'next-day':  0.10,
  'standard':  0.00,
};

const SPECIALTY = {
  piano:       { flat: 175, stairs: 300 },
  med1:        { flat: 50,  stairs: 75  },   // 300-450 lbs
  med2:        { flat: 275, stairs: 400 },   // 450-600 lbs
  heavy:       { flat: 600, stairs: 750 },   // 600+ lbs
};

const STAIR_FEE = 50; // per flight after 1st
const HAH_FEE   = 0.29;
const MIN_HOURS  = 2;

// ---- State ----
const state = {
  jobType:    'movers-truck',
  crew:       2,
  hours:      2,
  schedule:   'standard',
  stairsPickup:  0,
  stairsDropoff: 0,
  piano:      0, pianoStairs:  false,
  med1:       0, med1Stairs:   false,
  med2:       0, med2Stairs:   false,
  heavy:      0, heavyStairs:  false,
};

// ---- DOM refs ----
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  renderCrewOptions();
  bindJobType();
  bindSchedule();
  bindSteppers();
  bindCheckboxes();
  bindActions();
  recalculate();

  // Recalc on any input change (customer fields don't affect total)
  document.addEventListener('change', recalculate);
});

// ---- Job Type Toggle ----
function bindJobType() {
  $$('[data-job]').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('[data-job]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.jobType = btn.dataset.job;

      // Reset crew if invalid for new job type
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

// ---- Steppers ----
function bindSteppers() {
  const steppers = [
    { up: 'hoursUp',         down: 'hoursDown',         value: 'hoursValue',         key: 'hours',         min: MIN_HOURS, max: 16 },
    { up: 'stairsPickupUp',  down: 'stairsPickupDown',  value: 'stairsPickupValue',  key: 'stairsPickup',  min: 0, max: 10 },
    { up: 'stairsDropoffUp', down: 'stairsDropoffDown', value: 'stairsDropoffValue', key: 'stairsDropoff', min: 0, max: 10 },
    { up: 'pianoUp',         down: 'pianoDown',         value: 'pianoValue',         key: 'piano',         min: 0, max: 5 },
    { up: 'med1Up',          down: 'med1Down',          value: 'med1Value',          key: 'med1',          min: 0, max: 10 },
    { up: 'med2Up',          down: 'med2Down',          value: 'med2Value',          key: 'med2',          min: 0, max: 10 },
    { up: 'heavyUp',         down: 'heavyDown',         value: 'heavyValue',         key: 'heavy',         min: 0, max: 10 },
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

  // Scheduling surcharge
  const surchargeRate = SURCHARGES[state.schedule];
  let surchargeAmount = 0;
  if (surchargeRate > 0) {
    surchargeAmount = Math.round(subtotal * surchargeRate * 100) / 100;
    const label = state.schedule === 'same-day' ? 'Same-Day Surcharge (20%)' : 'Next-Day Surcharge (10%)';
    lines.push({ label, amount: surchargeAmount });
  }

  const grandTotal = subtotal + surchargeAmount;
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
  const custName  = $('#custName').value || 'Customer';
  const custPhone = $('#custPhone').value;
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

  const text = lines.join('\n');

  navigator.clipboard.writeText(text).then(() => {
    const btn = $('#btnCopy');
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = 'Copy Estimate'; }, 2000);
  }).catch(() => {
    // Fallback
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
