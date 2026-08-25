let RECORDS = [];
let REGIONS = [];
let HOME_REGION = {};
let COST_SUMMARY = null;

const LIVE_DATA_URL = '/api/te-forecast';

async function loadLiveData() {
  const subtitleEl = document.getElementById('subtitle');
  subtitleEl.textContent = 'Loading latest data\u2026';
  try {
    const res = await fetch(LIVE_DATA_URL);
    const json = await res.json();
    RECORDS = json.records;
    HOME_REGION = json.homeRegion;
    COST_SUMMARY = json.costSummary || null;
    REGIONS = ["NA","LATAM","EMEA","INDIA","APAC","JAPAN"].filter(r => RECORDS.some(rec => rec.region === r));
    if (!currentRegion) currentRegion = REGIONS[0];
    renderAll();
    if (COST_SUMMARY) renderCostView();
  } catch (err) {
    subtitleEl.textContent = 'Could not load live data \u2014 check the connection.';
    console.error(err);
  }
}
;
const SEARCHABLE = ["conference","person","role","venue"];
const SEARCH_LABELS = { conference: "Conference", person: "Person", role: "Role", venue: "Venue" };
const TODAY_ISO = new Date().toISOString().slice(0,10);

let currentRegion = null;
let activeFields = new Set(SEARCHABLE);
let sortMode = "date"; // date | name | budget
let sortDir = 1;
let openConfs = new Set(); // keys: region::conference

const tabsEl = document.getElementById('tabs');
const chipsEl = document.getElementById('fieldChips');
const sortRowEl = document.getElementById('sortRow');
const confListEl = document.getElementById('confList');
const searchInput = document.getElementById('searchInput');
const resultCount = document.getElementById('resultCount');
const emptyState = document.getElementById('emptyState');
const subtitle = document.getElementById('subtitle');

const personSearchInput = document.getElementById('personSearchInput');
const personGroups = document.getElementById('personGroups');
const personResultCount = document.getElementById('personResultCount');
const personEmptyState = document.getElementById('personEmptyState');

subtitle.innerHTML = `<span class="live-dot"></span>${REGIONS.length} region sheets · ${RECORDS.length} assignments · ${new Set(RECORDS.filter(r => !isAirport(r.conference)).map(r=>r.conference)).size} conferences`;

function fmtDate(iso) {
  if (!iso) return '<span class="muted">—</span>';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function fmtDateFull(iso) {
  if (!iso) return '<span class="muted">—</span>';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtBudget(n, currencyLabel) {
  if (n === null || n === undefined) return '<span class="muted">—</span>';
  const formatted = n.toLocaleString('en-US');
  return currencyLabel ? `${currencyLabel} ${formatted}` : formatted;
}

document.getElementById('modeBrowse').onclick = () => setMode('browse');
document.getElementById('modePerson').onclick = () => setMode('person');
document.getElementById('modeCost').onclick = () => setMode('cost');

function setMode(mode) {
  document.getElementById('modeBrowse').classList.toggle('active', mode === 'browse');
  document.getElementById('modePerson').classList.toggle('active', mode === 'person');
  document.getElementById('modeCost').classList.toggle('active', mode === 'cost');
  document.getElementById('browseView').style.display = mode === 'browse' ? 'block' : 'none';
  document.getElementById('personView').style.display = mode === 'person' ? 'block' : 'none';
  document.getElementById('costView').style.display = mode === 'cost' ? 'block' : 'none';
  if (mode === 'person') renderPersonView();
  if (mode === 'cost') renderCostView();
}

// Currency label per region, exactly as specified — not converted, just labeled.
const CURRENCY_LABEL = { NA: '$', LATAM: '$', APAC: 'AUS$', JAPAN: 'AUS$', INDIA: 'INR', EMEA: '€' };
// Team Budget figures (Browse by region / Person view) come from a different
// source dataset than the Cost Summary tab, and EMEA's figures there are in
// GBP, not EUR — confirmed against the client's approved 2026 peg rates.
const BUDGET_CURRENCY_LABEL = { NA: '$', LATAM: '$', APAC: 'AUS$', JAPAN: 'AUS$', INDIA: 'INR', EMEA: '£' };

function fmtMoney2(n, currencyLabel) {
  if (n === null || n === undefined) return '<span class="muted">—</span>';
  const formatted = n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currencyLabel ? `${currencyLabel} ${formatted}` : formatted;
}

function fmtDelta2(n, currencyLabel) {
  if (n === null || n === undefined) return null;
  const sign = n > 0 ? '+' : (n < 0 ? '\u2212' : '');
  const formatted = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${sign}${currencyLabel ? currencyLabel + ' ' : ''}${formatted}`;
}

// ---- USD conversion, using the client's approved 2026 peg rates ----
const PEG_TO_USD = { USD: 1, AUD: 0.6683, EUR: 1.1741995, GBP: 1.3452993, INR: 0.0111264 };
const BUDGET_CURRENCY_CODE = { NA: 'USD', LATAM: 'USD', APAC: 'AUD', JAPAN: 'AUD', INDIA: 'INR', EMEA: 'GBP' };
const COST_CURRENCY_CODE = { NA: 'USD', LATAM: 'USD', APAC: 'AUD', JAPAN: 'AUD', INDIA: 'INR', EMEA: 'EUR' };
let showUSD = false;

function convertIfNeeded(n, currencyCode) {
  if (n === null || n === undefined || !showUSD) return n;
  const rate = PEG_TO_USD[currencyCode];
  return rate ? n * rate : n;
}
// Wraps fmtBudget for Team Budget figures (region-aware currency, converts if toggled on)
function budgetDisplay(n, region) {
  const code = BUDGET_CURRENCY_CODE[region];
  const val = convertIfNeeded(n, code);
  const label = showUSD ? 'US$' : (BUDGET_CURRENCY_LABEL[region] || '');
  return fmtBudget(val, label);
}
// Wraps fmtMoney2 for Cost Summary figures
function costDisplay(n, region, nativeLabel) {
  const code = COST_CURRENCY_CODE[region];
  const val = convertIfNeeded(n, code);
  const label = showUSD ? 'US$' : nativeLabel;
  return fmtMoney2(val, label);
}
// Wraps fmtDelta2 for Cost Summary deltas
function costDeltaDisplay(n, region, nativeLabel) {
  const code = COST_CURRENCY_CODE[region];
  const val = convertIfNeeded(n, code);
  const label = showUSD ? 'US$' : nativeLabel;
  return fmtDelta2(val, label);
}

document.getElementById('usdToggle').onclick = () => {
  showUSD = !showUSD;
  document.getElementById('usdToggle').classList.toggle('active', showUSD);
  document.getElementById('usdToggle').textContent = showUSD ? 'Show native currencies' : 'Show in USD';
  renderRegionSummary(); renderConfList(); renderCostView();
  if (document.getElementById('personView').style.display !== 'none') renderPersonView();
};

let openCostRegions = new Set();

// Looks up the "T&E Forecast" figure for a conference — the same team
// budget total shown in the Browse by Region tab — by matching region +
// conference code between the two datasets.
function teamBudgetForConference(region, code) {
  if (!code) return null;
  const normalizedCode = code.trim().toUpperCase();
  const matches = RECORDS.filter(r => {
    if (r.region !== region) return false;
    const rCode = extractConfCode(r.conference);
    return rCode && rCode.trim().toUpperCase() === normalizedCode;
  });
  if (matches.length === 0) return null;
  return matches.reduce((s,r) => s + (r.totalBudget || 0), 0);
}

function renderCostView() {
  const headlineEl = document.getElementById('costHeadline');
  const gridEl = document.getElementById('costRegionGrid');

  if (!COST_SUMMARY || !COST_SUMMARY.blocks || COST_SUMMARY.blocks.length === 0) {
    headlineEl.innerHTML = `
      <div>
        <div class="label">Cost Summary</div>
        <div class="value" style="font-size:16px;">No cost data was returned from the sheet.</div>
        <div class="sub">Check that the "Cost Summary" tab still exists with that exact name, and that its rows follow the "Event (REGION)" block layout the parser expects.</div>
      </div>
    `;
    gridEl.innerHTML = "";
    return;
  }

  const totalsPresent = COST_SUMMARY.blocks.some(b => b.total !== null && b.total !== undefined);

  const overall = COST_SUMMARY.overallSaving;
  const overallKnown = overall !== null && overall !== undefined;
  const overallClass = overallKnown ? (overall > 0 ? 'positive' : (overall < 0 ? 'negative' : '')) : '';
  const overallLabel = !overallKnown ? 'YoY Change So Far' : (overall > 0 ? 'YoY Savings So Far (USD-equivalent)' : 'YoY Cost Increase So Far (USD-equivalent)');
  const overallValue = overallKnown ? fmtDelta2(overall, 'US$') : 'Not available';

  headlineEl.innerHTML = `
    <div>
      <div class="label">${overallLabel}</div>
      <div class="value ${overallClass}">${overallValue}</div>
      <div class="sub">Combines each region's year-over-year change, converted to a common USD basis so regions in different currencies can be compared on one line.
      ${!totalsPresent ? ' No region totals parsed from the sheet — the "Total" row label or column layout may differ from what the parser expects.' : ''}</div>
    </div>
  `;

  gridEl.innerHTML = "";
  COST_SUMMARY.blocks.forEach(block => {
    const currencyLabel = CURRENCY_LABEL[block.region] || block.currency || '';
    const isOpen = openCostRegions.has(block.region);

    // Compute totals directly from the visible per-conference rows rather than
    // trusting the sheet's own "Total" row parsing, which has proven unreliable
    // for regions where 2025/2026 prices sit in mismatched currency columns.
    const computedTotal2025 = block.events.reduce((s,ev) => s + (ev.price2025 || 0), 0);
    const computedTotal2026 = block.events.reduce((s,ev) => s + (ev.price2026 || 0), 0);
    const anyPrice2026Present = block.events.some(ev => ev.price2026 !== null && ev.price2026 !== undefined);
    const computedDelta = block.events.reduce((s,ev) => s + (ev.delta !== null && ev.delta !== undefined ? ev.delta : 0), 0);
    const anyDeltaPresent = block.events.some(ev => ev.delta !== null && ev.delta !== undefined);

    const deltaClass = !anyDeltaPresent ? 'none' : (computedDelta > 0 ? 'positive' : (computedDelta < 0 ? 'negative' : 'none'));
    const deltaText = !anyDeltaPresent
      ? 'No 2025 comparison available'
      : `${costDeltaDisplay(computedDelta, block.region, currencyLabel)} YoY`;

    const card = document.createElement('div');
    card.className = 'cost-region-card' + (isOpen ? ' open' : '');

    const head = document.createElement('div');
    head.className = 'cost-region-head';
    head.innerHTML = `
      <div>
        <div class="cost-region-name">${block.region}</div>
        <div class="cost-region-total">${costDisplay(computedTotal2025, block.region, currencyLabel)}</div>
        <div class="cost-region-delta ${deltaClass}">${deltaText}</div>
      </div>
      <span class="cost-chevron">›</span>
    `;
    head.onclick = () => {
      if (openCostRegions.has(block.region)) openCostRegions.delete(block.region);
      else openCostRegions.add(block.region);
      renderCostView();
    };
    card.appendChild(head);

    const body = document.createElement('div');
    body.className = 'cost-region-body';
    const table = document.createElement('table');
    table.innerHTML = `<thead><tr><th>Conference</th><th>T&E Forecast</th><th>2025 Actual</th><th>2026 Actual</th><th>YoY Delta</th></tr></thead>`;
    const tbody = document.createElement('tbody');
    let teamForecastTotal = 0;
    let anyTeamForecastPresent = false;
    block.events.forEach(ev => {
      const teamForecast = teamBudgetForConference(block.region, ev.code);
      if (teamForecast !== null) { teamForecastTotal += teamForecast; anyTeamForecastPresent = true; }
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${ev.code}</td>
        <td>${teamForecast !== null ? budgetDisplay(teamForecast, block.region) : '<span class="muted">—</span>'}</td>
        <td>${costDisplay(ev.price2025, block.region, currencyLabel)}</td>
        <td>${costDisplay(ev.price2026, block.region, currencyLabel)}</td>
        <td>${ev.delta === null || ev.delta === undefined ? '<span class="muted">—</span>' : costDeltaDisplay(ev.delta, block.region, currencyLabel)}</td>
      `;
      tbody.appendChild(tr);
    });

    const totalsTr = document.createElement('tr');
    totalsTr.style.borderTop = '2px solid var(--navy)';
    totalsTr.style.fontWeight = '700';
    totalsTr.innerHTML = `
      <td><b>Total</b></td>
      <td><b>${anyTeamForecastPresent ? budgetDisplay(teamForecastTotal, block.region) : '<span class="muted">—</span>'}</b></td>
      <td><b>${costDisplay(computedTotal2025, block.region, currencyLabel)}</b></td>
      <td><b>${anyPrice2026Present ? costDisplay(computedTotal2026, block.region, currencyLabel) : '<span class="muted">—</span>'}</b></td>
      <td><b>${anyDeltaPresent ? costDeltaDisplay(computedDelta, block.region, currencyLabel) : '<span class="muted">—</span>'}</b></td>
    `;
    tbody.appendChild(totalsTr);
    table.appendChild(tbody);
    body.appendChild(table);
    card.appendChild(body);

    gridEl.appendChild(card);
  });
}

function renderTabs() {
  tabsEl.innerHTML = "";
  REGIONS.forEach(region => {
    const confCount = new Set(RECORDS.filter(r => r.region === region && !isAirport(r.conference)).map(r => r.conference)).size;
    const btn = document.createElement('button');
    btn.className = 'tab' + (region === currentRegion ? ' active' : '');
    btn.innerHTML = `${region} <span class="count">${confCount}</span>`;
    btn.onclick = () => { currentRegion = region; searchInput.value = ""; renderAll(); };
    tabsEl.appendChild(btn);
  });
}

function renderChips() {
  chipsEl.innerHTML = "";
  const label = document.createElement('span');
  label.style.cssText = "font-family:'Inter',sans-serif;font-size:11px;font-weight:600;color:var(--text-faint);align-self:center;margin-right:2px;";
  label.textContent = "Search in:";
  chipsEl.appendChild(label);
  SEARCHABLE.forEach(field => {
    const chip = document.createElement('div');
    chip.className = 'chip' + (activeFields.has(field) ? ' active' : '');
    chip.textContent = SEARCH_LABELS[field];
    chip.onclick = () => { activeFields.has(field) ? activeFields.delete(field) : activeFields.add(field); renderConfList(); };
    chipsEl.appendChild(chip);
  });
}

const regionSummaryEl = document.getElementById('regionSummary');

function renderRegionSummary() {
  const regionRecords = RECORDS.filter(r => r.region === currentRegion);
  const totalCost = regionRecords.reduce((s,r) => s + (r.totalBudget||0), 0);
  const uniquePeople = new Set(regionRecords.map(r => r.person).filter(Boolean)).size;
  const confCount = new Set(regionRecords.filter(r => !isAirport(r.conference)).map(r => r.conference)).size;

  regionSummaryEl.innerHTML = `
    <div class="stat-card">
      <div class="stat-value">${budgetDisplay(totalCost, currentRegion)}</div>
      <div class="stat-label">Total forecasted cost</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${uniquePeople}</div>
      <div class="stat-label">Unique team members</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${confCount}</div>
      <div class="stat-label">Conferences</div>
    </div>
  `;
}

function renderSortRow() {
  sortRowEl.innerHTML = "";
  const label = document.createElement('span');
  label.style.cssText = "font-family:'Inter',sans-serif;font-size:11px;font-weight:600;color:var(--text-faint);align-self:center;margin-right:2px;";
  label.textContent = "Sort:";
  sortRowEl.appendChild(label);
  [["date","Event date"],["name","Name"],["budget","Team budget"]].forEach(([key,lbl]) => {
    const btn = document.createElement('button');
    btn.className = 'sort-btn' + (sortMode === key ? ' active' : '');
    btn.textContent = lbl + (sortMode === key ? (sortDir === 1 ? ' ▲' : ' ▼') : '');
    btn.onclick = () => { sortDir = (sortMode === key) ? -sortDir : 1; sortMode = key; renderConfList(); };
    sortRowEl.appendChild(btn);
  });
}

function rolePriority(role) {
  const r = (role || '').toLowerCase();
  if (r.includes('reg lead')) return 0;
  if (r.includes('reg support')) return 1;
  if (r.includes('it lead')) return 2;
  if (r.includes('it support')) return 3;
  if (r.includes('zone lead')) return 5;
  return 4; // everything else (Housing, FOH, Exec support, etc.) sits before zone leads
}

function findRegLead(people) {
  const lead = people.find(p => (p.role || '').toLowerCase().includes('reg lead'));
  return lead ? lead.person : null;
}

function extractConfCode(conference) {
  const m = conference && conference.match(/\(([^)]+)\)\s*$/);
  return m ? m[1] : null;
}
function stripConfCode(conference) {
  return conference ? conference.replace(/\s*\([^)]+\)\s*$/, '') : conference;
}

function highlight(text, term) {
  if (!term || !text) return text || '';
  const idx = text.toLowerCase().indexOf(term.toLowerCase());
  if (idx === -1) return text;
  return text.slice(0, idx) + '<mark>' + text.slice(idx, idx + term.length) + '</mark>' + text.slice(idx + term.length);
}

// "Airport" entries are satellite/logistics assignments tied to an existing
// conference (same code, e.g. SYM36 appears as both the main conference and
// an "Airport" variant) — not a standalone conference, so they're excluded
// from conference lists, counts, and clash detection.
function isAirport(conference) {
  return /airport/i.test(conference || '');
}

// A clash is a "back-to-back" (not a real scheduling problem) when both
// legs are in the same city/country — compares the last two comma-separated
// parts of the venue string rather than the exact venue text, so a same-city
// change of hotel still counts as back-to-back rather than a clash.
function locationKey(venue) {
  if (!venue) return null;
  const parts = venue.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length < 2) return venue.trim().toLowerCase();
  return parts.slice(-2).join(', ').toLowerCase();
}

function groupConferences(region) {
  const map = new Map();
  RECORDS.filter(r => r.region === region).forEach(r => {
    if (!map.has(r.conference)) {
      map.set(r.conference, {
        conference: r.conference,
        venue: r.venue,
        eventStart: r.eventStart,
        eventEnd: r.eventEnd,
        eventDatesText: r.eventDatesText,
        region: r.region,
        people: []
      });
    }
    map.get(r.conference).people.push(r);
  });
  return [...map.values()];
}

function renderConfList() {
  const term = searchInput.value.trim().toLowerCase();
  let confs = groupConferences(currentRegion);

  // filter: a conference matches if the conference/venue matches, OR any person/role within it matches
  if (term) {
    confs = confs.filter(c => {
      const confMatch = (activeFields.has("conference") && c.conference.toLowerCase().includes(term)) ||
                        (activeFields.has("venue") && c.venue && c.venue.toLowerCase().includes(term));
      const peopleMatch = c.people.some(p =>
        (activeFields.has("person") && p.person && p.person.toLowerCase().includes(term)) ||
        (activeFields.has("role") && p.role && p.role.toLowerCase().includes(term))
      );
      return confMatch || peopleMatch;
    });
  }

  confs.sort((a,b) => {
    if (sortMode === "name") return a.conference.localeCompare(b.conference) * sortDir;
    if (sortMode === "budget") {
      const ba = a.people.reduce((s,p)=>s+(p.totalBudget||0),0);
      const bb = b.people.reduce((s,p)=>s+(p.totalBudget||0),0);
      return (ba-bb) * sortDir;
    }
    return String(a.eventStart||'').localeCompare(String(b.eventStart||'')) * sortDir;
  });

  confListEl.innerHTML = "";
  confs.forEach(c => {
    const key = c.region + '::' + c.conference;
    // auto-expand if search matches inside the people list (not just the conference itself)
    const peopleMatch = term && c.people.some(p =>
      (activeFields.has("person") && p.person && p.person.toLowerCase().includes(term)) ||
      (activeFields.has("role") && p.role && p.role.toLowerCase().includes(term))
    );
    const isOpen = openConfs.has(key) || peopleMatch;

    const item = document.createElement('div');
    const isPast = c.eventEnd && c.eventEnd < TODAY_ISO;
    item.className = 'conf-item' + (isOpen ? ' open' : '') + (isPast ? ' past' : '');

    const budgetTotal = c.people.reduce((s,p)=>s+(p.totalBudget||0),0);
    const regLead = findRegLead(c.people);
    const confCode = extractConfCode(c.conference);
    const confName = stripConfCode(c.conference);

    let daysUntilBadge = '';
    if (!isPast && c.eventStart) {
      const daysUntil = Math.round((new Date(c.eventStart + 'T00:00:00') - new Date(TODAY_ISO + 'T00:00:00')) / 86400000);
      if (daysUntil === 0) daysUntilBadge = '<span class="days-until-badge">today</span>';
      else if (daysUntil > 0) daysUntilBadge = `<span class="days-until-badge">in ${daysUntil} day${daysUntil === 1 ? '' : 's'}</span>`;
    }

    const head = document.createElement('div');
    head.className = 'conf-header';
    head.innerHTML = `
      <span class="chevron">›</span>
      <div class="conf-main">
        <div class="conf-title-row">
          <span class="conf-title">${highlight(confName, activeFields.has("conference") ? term : "")}</span>
          ${confCode ? `<span class="conf-code">${confCode}</span>` : ''}
          ${isPast ? '<span class="past-badge">Completed</span>' : ''}
          ${daysUntilBadge}
        </div>
        ${c.venue ? `<div class="conf-venue">${highlight(c.venue, activeFields.has("venue") ? term : "")}</div>` : ''}
        ${regLead ? `<div class="conf-reglead"><b>Reg Lead</b> ${regLead}</div>` : ''}
      </div>
      <div class="conf-meta"><b>${c.people.length}</b> on team<br>${budgetDisplay(budgetTotal, c.region)} total</div>
      <div class="conf-dates"><span class="label">Event</span>${fmtDate(c.eventStart)}<span class="dash">–</span>${fmtDateFull(c.eventEnd)}</div>
    `;
    head.onclick = () => {
      if (openConfs.has(key)) openConfs.delete(key); else openConfs.add(key);
      renderConfList();
    };
    item.appendChild(head);

    const body = document.createElement('div');
    body.className = 'conf-body';
    const peopleSorted = c.people.slice().sort((a,b) => {
      const pa = rolePriority(a.role), pb = rolePriority(b.role);
      if (pa !== pb) return pa - pb;
      return (a.role||'').localeCompare(b.role||'');
    });
    const table = document.createElement('table');
    table.innerHTML = `<thead><tr><th>Person</th><th>Role</th><th>In Date</th><th>Out Date</th><th>Total Budget</th></tr></thead>`;
    const tbody = document.createElement('tbody');
    peopleSorted.forEach(p => {
      const tr = document.createElement('tr');
      const home = p.person ? HOME_REGION[p.person] : null;
      const crossRegion = home && home !== c.region;
      tr.innerHTML = `
        <td>${p.person ? highlight(p.person, activeFields.has("person") ? term : "") : '<span class="muted">Unassigned</span>'}${crossRegion ? `<span class="cross-region-badge" title="Home region: ${home}">⇄ ${home}</span>` : ''}</td>
        <td><span class="role-pill">${highlight(p.role, activeFields.has("role") ? term : "")}</span></td>
        <td>${fmtDateFull(p.inDate)}</td>
        <td>${fmtDateFull(p.outDate)}</td>
        <td>${budgetDisplay(p.totalBudget, c.region)}</td>
      `;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    body.appendChild(table);
    item.appendChild(body);

    confListEl.appendChild(item);
  });

  emptyState.style.display = confs.length === 0 ? 'block' : 'none';
  resultCount.textContent = `${confs.length} of ${groupConferences(currentRegion).filter(c => !isAirport(c.conference)).length} conferences`;
}

function renderAll() { renderTabs(); renderRegionSummary(); renderChips(); renderSortRow(); renderConfList(); renderGlobalClashBadge(); }
searchInput.addEventListener('input', renderConfList);

function datesOverlap(aStart, aEnd, bStart, bEnd) { return aStart <= bEnd && bStart <= aEnd; }

// A record doesn't count toward a clash if its conference has already
// completed, or if it's an "Airport" satellite assignment rather than a
// real standalone conference — neither represents an active scheduling risk.
function excludedFromClash(record) {
  const completed = record.eventEnd && record.eventEnd < TODAY_ISO;
  return completed || isAirport(record.conference);
}

// Returns every overlapping pair within a records array, each tagged
// 'clash' (different cities) or 'backToBack' (same city — just a same-day
// handoff, not a real problem).
function computeClashPairs(records) {
  const pairs = [];
  for (let i = 0; i < records.length; i++) {
    if (!records[i].inDate || !records[i].outDate) continue;
    if (excludedFromClash(records[i])) continue;
    for (let j = i + 1; j < records.length; j++) {
      if (!records[j].inDate || !records[j].outDate) continue;
      if (excludedFromClash(records[j])) continue;
      if (datesOverlap(records[i].inDate, records[i].outDate, records[j].inDate, records[j].outDate)) {
        const locA = locationKey(records[i].venue);
        const locB = locationKey(records[j].venue);
        const type = (locA && locB && locA === locB) ? 'backToBack' : 'clash';
        pairs.push({ i, j, type });
      }
    }
  }
  return pairs;
}

// Maps each record index to its worst-case type — 'clash' always wins over
// 'backToBack' if a record is involved in both kinds of overlap.
function indexTypeMap(pairs) {
  const map = new Map();
  pairs.forEach(p => { if (p.type === 'backToBack') { map.set(p.i, 'backToBack'); map.set(p.j, 'backToBack'); } });
  pairs.forEach(p => { if (p.type === 'clash') { map.set(p.i, 'clash'); map.set(p.j, 'clash'); } });
  return map;
}

// Runs across EVERY assigned person, regardless of how many conferences they
// have — used for the always-visible header badge so a clash is never hidden
// behind the By Person tab's 4+ filter. Returns separate counts for real
// clashes and back-to-back-only people (someone with any real clash counts
// only toward clashCount, even if they also have a back-to-back elsewhere).
function computeGlobalCounts() {
  const byPerson = {};
  RECORDS.forEach(r => {
    if (!r.person || !r.inDate || !r.outDate) return;
    (byPerson[r.person] = byPerson[r.person] || []).push(r);
  });
  let clashCount = 0;
  let backOnlyCount = 0;
  Object.values(byPerson).forEach(records => {
    const pairs = computeClashPairs(records);
    const hasClash = pairs.some(p => p.type === 'clash');
    const hasBack = pairs.some(p => p.type === 'backToBack');
    if (hasClash) clashCount++;
    else if (hasBack) backOnlyCount++;
  });
  return { clashCount, backOnlyCount };
}

function renderGlobalClashBadge() {
  const badge = document.getElementById('clashBadgeGlobal');
  const { clashCount, backOnlyCount } = computeGlobalCounts();
  if (clashCount > 0) {
    badge.className = 'clash-badge-global warn';
    badge.textContent = `⚠ ${clashCount} people with overlapping trips`;
    badge.onclick = () => { setMode('person'); };
  } else if (backOnlyCount > 0) {
    badge.className = 'clash-badge-global backtoback';
    badge.textContent = `⇄ ${backOnlyCount} people with back-to-back stays`;
    badge.onclick = () => { setMode('person'); };
  } else {
    badge.className = 'clash-badge-global clear';
    badge.textContent = 'No overlapping trips detected';
    badge.onclick = null;
  }
}

let openPersons = new Set();

// ---- CSV export ----
function downloadCSV(filename, headers, rows) {
  const escape = (v) => {
    const s = (v === null || v === undefined) ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [headers.map(escape).join(',')].concat(rows.map(r => r.map(escape).join(',')));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

document.getElementById('exportBrowseBtn').onclick = () => {
  const rows = [];
  const confs = groupConferences(currentRegion);
  confs.forEach(c => {
    c.people.forEach(p => {
      rows.push([
        c.region, stripConfCode(c.conference), extractConfCode(c.conference) || '', c.venue || '',
        c.eventStart || '', c.eventEnd || '', p.person || 'Unassigned', p.role || '',
        p.inDate || '', p.outDate || '', p.totalBudget !== null && p.totalBudget !== undefined ? p.totalBudget : '',
        BUDGET_CURRENCY_LABEL[c.region] || ''
      ]);
    });
  });
  downloadCSV(`${currentRegion}-conferences.csv`,
    ['Region','Conference','Code','Venue','Event Start','Event End','Person','Role','In Date','Out Date','Total Budget','Currency'],
    rows);
};

document.getElementById('exportPersonBtn').onclick = () => {
  const counts = {};
  RECORDS.forEach(r => { if (r.person) counts[r.person] = (counts[r.person] || 0) + 1; });
  const people = Object.keys(counts).filter(p => counts[p] > 3).sort();
  const rows = [];
  people.forEach(person => {
    const records = RECORDS.filter(r => r.person === person).slice().sort((a,b) => (a.inDate||'').localeCompare(b.inDate||''));
    const typeMap = indexTypeMap(computeClashPairs(records));
    records.forEach((r, i) => {
      const type = typeMap.get(i) || null;
      rows.push([person, r.region, r.conference, r.role, r.inDate || '', r.outDate || '',
        r.totalBudget !== null && r.totalBudget !== undefined ? r.totalBudget : '', BUDGET_CURRENCY_LABEL[r.region] || '',
        type === 'clash' ? 'Clash' : type === 'backToBack' ? 'Back-to-back' : '']);
    });
  });
  downloadCSV('people-conferences.csv',
    ['Person','Region','Conference','Role','In Date','Out Date','Total Budget','Currency','Overlap Type'],
    rows);
};

document.getElementById('exportCostBtn').onclick = () => {
  if (!COST_SUMMARY) return;
  const rows = [];
  COST_SUMMARY.blocks.forEach(block => {
    const currencyLabel = CURRENCY_LABEL[block.region] || block.currency || '';
    let teamForecastTotal = 0;
    block.events.forEach(ev => {
      const teamForecast = teamBudgetForConference(block.region, ev.code);
      if (teamForecast !== null) teamForecastTotal += teamForecast;
      rows.push([block.region, ev.code, teamForecast ?? '', ev.price2025 ?? '', ev.price2026 ?? '', ev.delta ?? '', currencyLabel]);
    });
    const t2025 = block.events.reduce((s,ev) => s + (ev.price2025 || 0), 0);
    const t2026 = block.events.reduce((s,ev) => s + (ev.price2026 || 0), 0);
    const tDelta = block.events.reduce((s,ev) => s + (ev.delta !== null && ev.delta !== undefined ? ev.delta : 0), 0);
    rows.push([block.region, 'TOTAL', teamForecastTotal, t2025, t2026, tDelta, currencyLabel]);
  });
  downloadCSV('cost-summary.csv', ['Region','Conference Code','T&E Forecast','2025 Actual','2026 Actual','YoY Delta','Currency'], rows);
};

function renderPersonView() {
  const term = personSearchInput.value.trim().toLowerCase();
  const counts = {};
  RECORDS.forEach(r => { if (r.person) counts[r.person] = (counts[r.person] || 0) + 1; });
  const people = Object.keys(counts).filter(p => counts[p] > 3).sort();
  const matched = term ? people.filter(p => p.toLowerCase().includes(term)) : people;

  personGroups.innerHTML = "";
  let totalClashCount = 0;

  matched.forEach(person => {
    const records = RECORDS.filter(r => r.person === person)
      .slice()
      .sort((a,b) => (a.inDate||'').localeCompare(b.inDate||''));
    const pairs = computeClashPairs(records);
    const typeMap = indexTypeMap(pairs);
    const clashIndices = [...typeMap.entries()].filter(([,t]) => t === 'clash').map(([i]) => i);
    const backIndices = [...typeMap.entries()].filter(([,t]) => t === 'backToBack').map(([i]) => i);
    const hasClash = clashIndices.length > 0;
    const hasBackToBack = backIndices.length > 0;
    if (hasClash) totalClashCount++;
    const isOpen = openPersons.has(person);

    const budgetTotal = records.reduce((s,r)=> s + (r.totalBudget||0), 0);
    const distinctRegions = new Set(records.map(r => r.region));
    let budgetTotalText;
    if (showUSD) {
      const usdSum = records.reduce((s,r) => s + (convertIfNeeded(r.totalBudget, BUDGET_CURRENCY_CODE[r.region]) || 0), 0);
      budgetTotalText = `US$ ${usdSum.toLocaleString('en-US')}`;
    } else {
      const aggCurrency = distinctRegions.size === 1 ? (BUDGET_CURRENCY_LABEL[records[0].region] || '') : null;
      budgetTotalText = aggCurrency
        ? `${aggCurrency} ${budgetTotal.toLocaleString('en-US')}`
        : `${budgetTotal.toLocaleString('en-US')} (mixed currencies)`;
    }

    // Total travel days: sum of onsite nights across all trips (simple sum, not
    // de-duplicated for overlaps — clashes are already flagged separately above).
    const totalTravelDays = records.reduce((s,r) => {
      if (!r.inDate || !r.outDate) return s;
      const days = Math.round((new Date(r.outDate) - new Date(r.inDate)) / 86400000) + 1;
      return s + Math.max(days, 0);
    }, 0);

    const item = document.createElement('div');
    item.className = 'person-item' + (isOpen ? ' open' : '')
      + (hasClash ? ' has-clash' : (hasBackToBack ? ' has-backtoback' : ''));

    const header = document.createElement('div');
    header.className = 'person-header';
    let statusHtml;
    if (hasClash) {
      statusHtml = `<div class="clash-status warn">⚠ ${clashIndices.length} overlapping trip${clashIndices.length===1?'':'s'}</div>`;
    } else if (hasBackToBack) {
      statusHtml = `<div class="clash-status backtoback">⇄ ${backIndices.length} back-to-back${backIndices.length===1?'':'s'}</div>`;
    } else {
      statusHtml = `<div class="clash-status clear">✓ No clashes</div>`;
    }
    header.innerHTML = `
      <span class="person-chevron">›</span>
      <div class="person-name">${person}</div>
      <div class="person-meta">${records.length} conference${records.length === 1 ? '' : 's'} · ${totalTravelDays} travel day${totalTravelDays === 1 ? '' : 's'} · ${budgetTotalText} total</div>
      ${statusHtml}
    `;
    header.onclick = () => {
      if (openPersons.has(person)) openPersons.delete(person);
      else openPersons.add(person);
      renderPersonView();
    };
    item.appendChild(header);

    const body = document.createElement('div');
    body.className = 'person-body';
    const tableWrap = document.createElement('div');
    tableWrap.className = 'person-table-scroll';
    const table = document.createElement('table');
    table.innerHTML = `<thead><tr><th>Region</th><th>Conference</th><th>Role</th><th>In Date</th><th>Out Date</th><th>Total Budget</th></tr></thead>`;
    const tbody = document.createElement('tbody');
    records.forEach((r, i) => {
      const type = typeMap.get(i) || null;
      const tr = document.createElement('tr');
      if (type === 'clash') tr.className = 'clash-row';
      else if (type === 'backToBack') tr.className = 'backtoback-row';
      const flag = type === 'clash'
        ? ' <span class="clash-flag">⚠ overlap</span>'
        : type === 'backToBack'
          ? ' <span class="backtoback-flag">⇄ back-to-back</span>'
          : '';
      tr.innerHTML = `
        <td>${r.region}</td>
        <td>${r.conference}${flag}</td>
        <td><span class="role-pill">${r.role}</span></td>
        <td>${fmtDateFull(r.inDate)}</td>
        <td>${fmtDateFull(r.outDate)}</td>
        <td>${budgetDisplay(r.totalBudget, r.region)}</td>
      `;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    tableWrap.appendChild(table);
    body.appendChild(tableWrap);
    item.appendChild(body);

    personGroups.appendChild(item);
  });

  personEmptyState.style.display = matched.length === 0 ? 'block' : 'none';
  personResultCount.textContent = `${matched.length} of ${people.length} people with 4+ conferences` + (totalClashCount ? ` · ${totalClashCount} with overlapping trips` : '');
}

personSearchInput.addEventListener('input', renderPersonView);

loadLiveData();
// Refresh automatically every 5 minutes while the page is open
setInterval(loadLiveData, 5 * 60 * 1000);
