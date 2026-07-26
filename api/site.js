// Vercel serverless function: serves the T&E forecast page, but only
// after the visitor enters a username/password (checked via HTTP Basic
// Auth — the browser shows its own built-in login popup, no custom
// login page needed).

const PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>GPJ 2026 Gartner T&E Forecast</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@600;700;800&family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root {
    --navy: #002856; --navy-deep: #001B3A; --accent: #C8102E;
    --bg: #FFFFFF; --bg-soft: #F4F6F9;
    --text: #1A2B3C; --text-soft: #5B6B7F; --text-faint: #8A97A8;
    --line: #E2E6EC; --clash: #C8102E; --clash-soft: #FCEAEC;
    --gold: #A67C27; --gold-soft: #F7F0E2;
    --green: #1E8A4C; --green-soft: #E5F4EA;
    --shadow: 0 2px 10px rgba(0,40,86,0.08);
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font-family: 'Inter', sans-serif; min-height: 100vh; }
  .wrap { max-width: 1220px; margin: 0 auto; padding: 0 24px 90px; }

  header {
    display: flex; align-items: center; justify-content: space-between;
    background: var(--navy); margin: 0 -24px 24px; padding: 32px 24px;
  }
  h1 { font-family: 'Libre Franklin', sans-serif; font-weight: 800; font-size: 34px; margin: 0; color: #fff; letter-spacing: -0.3px; }
  .subtitle-row { display: flex; align-items: center; gap: 14px; margin-top: 10px; flex-wrap: wrap; }
  .subtitle { font-size: 12.5px; color: rgba(255,255,255,0.68); font-family: 'IBM Plex Mono', monospace; display: flex; align-items: center; gap: 7px; }
  .live-dot { width: 6px; height: 6px; border-radius: 50%; background: #7FE0A8; flex-shrink: 0; box-shadow: 0 0 0 0 rgba(127,224,168,0.5); animation: pulse 2.2s infinite; }
  @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(127,224,168,0.45); } 70% { box-shadow: 0 0 0 6px rgba(127,224,168,0); } 100% { box-shadow: 0 0 0 0 rgba(127,224,168,0); } }
  .refresh-btn {
    font-family: 'Inter', sans-serif; font-size: 11.5px; font-weight: 600; color: #fff; background: rgba(255,255,255,0.12);
    border: 1px solid rgba(255,255,255,0.25); border-radius: 4px; padding: 5px 12px; cursor: pointer; transition: background 0.15s ease;
  }
  .refresh-btn:hover { background: rgba(255,255,255,0.22); }
  .refresh-btn:disabled { opacity: 0.5; cursor: default; }
  .clash-badge {
    display: inline-flex; align-items: center; gap: 6px; background: var(--accent); color: #fff;
    font-family: 'Inter', sans-serif; font-weight: 700; font-size: 12px; padding: 8px 14px; border-radius: 20px;
    cursor: pointer; border: none; white-space: nowrap;
  }
  .clash-badge.none { background: rgba(255,255,255,0.12); color: rgba(255,255,255,0.7); cursor: default; }

  .attention-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 24px; }
  .attn-card { background: var(--bg); border: 1px solid var(--line); border-top: 3px solid var(--navy); border-radius: 6px; box-shadow: var(--shadow); padding: 16px 18px; }
  .attn-card.warn { border-top-color: var(--accent); }
  .attn-label { font-family: 'Inter', sans-serif; font-size: 10.5px; font-weight: 700; color: var(--text-soft); text-transform: uppercase; letter-spacing: 0.7px; }
  .attn-value { font-family: 'IBM Plex Mono', monospace; font-weight: 600; font-size: 26px; color: var(--navy); margin-top: 6px; }
  .attn-value.warn { color: var(--accent); }
  .attn-value.positive { color: var(--green); }
  .attn-value.negative { color: var(--accent); }
  .attn-detail { font-family: 'Inter', sans-serif; font-size: 11.5px; color: var(--text-soft); margin-top: 8px; line-height: 1.5; }
  .attn-detail a { color: var(--navy); font-weight: 600; cursor: pointer; text-decoration: none; }
  .attn-detail a:hover { text-decoration: underline; }
  .attn-list { margin-top: 6px; display: flex; flex-direction: column; gap: 4px; }
  .attn-list-item { font-family: 'Inter', sans-serif; font-size: 11.5px; color: var(--text); }
  .attn-list-item b { color: var(--navy); }
  .attn-empty { font-family: 'Inter', sans-serif; font-size: 11.5px; color: var(--green); font-weight: 600; }

  .cost-strip { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-bottom: 24px; }
  .cost-chip { background: var(--bg-soft); border: 1px solid var(--line); border-radius: 6px; padding: 10px 12px; text-align: center; }
  .cost-chip .region { font-family: 'Libre Franklin', sans-serif; font-weight: 700; font-size: 11.5px; color: var(--navy); }
  .cost-chip .total { font-family: 'IBM Plex Mono', monospace; font-weight: 600; font-size: 13px; color: var(--text); margin-top: 4px; }
  .cost-chip .delta { font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; margin-top: 2px; }
  .cost-chip .delta.positive { color: var(--green); }
  .cost-chip .delta.negative { color: var(--accent); }
  .cost-chip .delta.none { color: var(--text-faint); }

  .mode-switch { display: inline-flex; background: var(--bg-soft); border: 1px solid var(--line); border-radius: 6px; padding: 3px; margin-bottom: 20px; }
  .mode-btn { font-family: 'Libre Franklin', sans-serif; font-weight: 700; font-size: 13.5px; padding: 9px 20px; border: none; background: transparent; color: var(--text-soft); border-radius: 4px; cursor: pointer; transition: all 0.15s ease; }
  .mode-btn.active { background: var(--navy); color: #fff; }
  .mode-btn:not(.active):hover { color: var(--navy); }

  .search-row { display: flex; gap: 12px; align-items: center; margin-bottom: 14px; }
  .search-box { flex: 1; position: relative; }
  .search-box input { width: 100%; padding: 11px 14px 11px 40px; font-family: 'Inter', sans-serif; font-size: 14.5px; border: 1.5px solid var(--line); border-radius: 4px; background: var(--bg); color: var(--text); }
  .search-box input::placeholder { color: var(--text-faint); }
  .search-box input:focus { outline: none; border-color: var(--navy); box-shadow: 0 0 0 3px rgba(0,40,86,0.1); }
  .search-box::before { content: ""; position: absolute; left: 14px; top: 50%; width: 13px; height: 13px; transform: translateY(-50%); border: 1.5px solid var(--text-faint); border-radius: 50%; }
  .search-box::after { content: ""; position: absolute; left: 25px; top: 61%; width: 7px; height: 1.5px; background: var(--text-faint); transform: rotate(45deg); }
  .result-count { font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; color: var(--text-soft); white-space: nowrap; }

  .filter-row { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; align-items: center; }
  .filter-label { font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 600; color: var(--text-faint); margin-right: 2px; }
  .chip { font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 500; padding: 5px 12px; border: 1px solid var(--line); border-radius: 20px; background: var(--bg); color: var(--text-soft); cursor: pointer; user-select: none; transition: all 0.12s ease; }
  .chip.active { background: var(--navy); border-color: var(--navy); color: white; }
  .chip.region-chip.active { background: var(--accent); border-color: var(--accent); }

  .sort-row { display: flex; gap: 8px; margin-bottom: 16px; align-items: center; }
  .sort-btn { font-family: 'Inter', sans-serif; font-size: 11.5px; font-weight: 500; padding: 5px 11px; border: 1px solid var(--line); border-radius: 4px; background: var(--bg); color: var(--text-soft); cursor: pointer; transition: all 0.12s ease; }
  .sort-btn.active { border-color: var(--navy); color: var(--navy); font-weight: 700; }

  .panel { background: var(--bg); border: 1px solid var(--line); border-radius: 6px; box-shadow: var(--shadow); overflow: hidden; }
  .conf-list { display: flex; flex-direction: column; }
  .conf-item { border-bottom: 1px solid var(--line); border-left: 3px solid transparent; }
  .conf-item:last-child { border-bottom: none; }
  .conf-item.open { border-left-color: var(--accent); }
  .conf-item.has-clash { border-left-color: var(--accent); background: var(--clash-soft); }

  .conf-header { display: flex; align-items: center; gap: 16px; padding: 16px 20px; cursor: pointer; transition: background 0.12s ease; }
  .conf-header:hover { background: var(--bg-soft); }
  .conf-item.open .conf-header { background: var(--bg-soft); }

  .chevron { font-family: 'IBM Plex Mono', monospace; font-size: 15px; color: var(--accent); width: 14px; flex-shrink: 0; transition: transform 0.2s ease; }
  .conf-item.open .chevron { transform: rotate(90deg); }

  .region-tag {
    font-family: 'IBM Plex Mono', monospace; font-size: 10px; font-weight: 700; color: #fff; background: var(--navy);
    border-radius: 3px; padding: 2px 7px; letter-spacing: 0.4px; flex-shrink: 0;
  }

  .conf-main { flex: 1.6; min-width: 0; }
  .conf-title-row { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
  .conf-title { font-family: 'Libre Franklin', sans-serif; font-weight: 700; font-size: 15px; color: var(--navy); }
  .conf-code { font-family: 'IBM Plex Mono', monospace; font-size: 10px; font-weight: 600; color: var(--navy); border: 1px solid var(--line); background: var(--bg-soft); border-radius: 3px; padding: 1px 6px; letter-spacing: 0.4px; }
  .conf-venue { font-family: 'Inter', sans-serif; font-size: 11.5px; color: var(--text-soft); margin-top: 3px; }
  .conf-reglead { font-family: 'Inter', sans-serif; font-size: 11.5px; color: var(--text-soft); margin-top: 3px; }
  .conf-reglead b { color: var(--navy); font-weight: 600; }
  .cross-region-badge { display: inline-block; margin-left: 6px; padding: 1px 7px; border-radius: 3px; font-size: 10px; font-family: 'IBM Plex Mono', monospace; font-weight: 600; background: var(--gold-soft); color: var(--gold); white-space: nowrap; }
  .clash-inline-badge { display: inline-flex; align-items: center; gap: 4px; margin-left: 6px; padding: 1px 7px; border-radius: 3px; font-size: 10px; font-family: 'IBM Plex Mono', monospace; font-weight: 700; background: var(--accent); color: #fff; white-space: nowrap; }

  .conf-dates { font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; color: var(--navy); white-space: nowrap; text-align: right; flex: 0.9; }
  .conf-dates .label { display: block; font-size: 9px; color: var(--text-faint); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px; font-family: 'Inter', sans-serif; font-weight: 600; }
  .conf-dates .dash { color: var(--accent); margin: 0 4px; }

  .past-badge { display: inline-block; margin-left: 2px; padding: 2px 8px; border-radius: 3px; font-size: 9px; font-family: 'Inter', sans-serif; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase; background: var(--bg-soft); color: var(--text-faint); border: 1px solid var(--line); }
  .conf-item.past .conf-header { opacity: 0.6; }
  .conf-item.past .conf-header:hover { opacity: 0.9; }
  .conf-item.past.open .conf-header { opacity: 1; }

  .conf-meta { font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; color: var(--text-soft); white-space: nowrap; text-align: right; min-width: 100px; line-height: 1.5; flex: 0.6; }
  .conf-meta b { color: var(--navy); }

  .conf-cost { font-family: 'IBM Plex Mono', monospace; font-size: 12px; text-align: right; white-space: nowrap; flex: 0.9; }
  .conf-cost .label { display: block; font-size: 9px; color: var(--text-faint); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px; font-family: 'Inter', sans-serif; font-weight: 600; }
  .conf-cost .delta.positive { color: var(--green); }
  .conf-cost .delta.negative { color: var(--accent); }
  .conf-cost .delta.none { color: var(--text-faint); }

  .conf-body { max-height: 0; opacity: 0; overflow: hidden; padding: 0 20px 0 56px; transition: max-height 0.28s ease, opacity 0.2s ease, padding 0.28s ease; }
  .conf-item.open .conf-body { max-height: 900px; opacity: 1; padding: 0 20px 18px 56px; }
  .conf-body-section { margin-top: 12px; }
  .conf-body-heading { font-family: 'Inter', sans-serif; font-size: 10.5px; font-weight: 700; color: var(--text-faint); text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 6px; }

  table { width: 100%; border-collapse: collapse; font-family: 'IBM Plex Mono', monospace; font-size: 12px; }
  thead th { text-align: left; padding: 8px 12px; font-weight: 600; font-size: 10px; letter-spacing: 0.6px; text-transform: uppercase; color: var(--text-faint); border-bottom: 1px solid var(--line); font-family: 'Inter', sans-serif; }
  tbody tr { border-bottom: 1px solid var(--line); }
  tbody tr:last-child { border-bottom: none; }
  tbody tr:hover { background: var(--bg-soft); }
  tbody td { padding: 9px 12px; color: var(--text); vertical-align: top; }
  .muted { color: var(--text-faint); }
  mark { background: #FDE9A8; color: var(--text); padding: 0 3px; border-radius: 2px; font-weight: 600; }
  .role-pill { display: inline-block; padding: 2px 9px; border-radius: 3px; font-size: 10.5px; font-weight: 600; background: #E3EBF5; color: var(--navy); white-space: nowrap; font-family: 'IBM Plex Mono', monospace; }
  .clash-row { background: var(--clash-soft); }
  .clash-flag { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 700; color: var(--clash); font-family: 'IBM Plex Mono', monospace; }

  .empty { padding: 60px 20px; text-align: center; color: var(--text-soft); font-family: 'Libre Franklin', sans-serif; font-weight: 700; font-size: 16px; }

  .person-groups { display: flex; flex-direction: column; gap: 18px; padding: 4px 0; }
  .person-card { background: var(--bg); border: 1px solid var(--line); border-radius: 6px; box-shadow: var(--shadow); overflow: hidden; }
  .person-card-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; background: var(--navy); }
  .person-name { font-family: 'Libre Franklin', sans-serif; font-weight: 700; font-size: 16px; color: #fff; }
  .person-meta { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: rgba(255,255,255,0.75); margin-top: 4px; }
  .person-warning { font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 5px; background: rgba(200,16,46,0.35); padding: 5px 10px; border-radius: 4px; }
  .person-table-scroll { overflow-x: auto; }

  footer { margin-top: 22px; font-family: 'Inter', sans-serif; font-size: 11.5px; color: var(--text-faint); line-height: 1.7; border-top: 1px solid var(--line); padding-top: 18px; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div>
      <h1>GPJ 2026 Gartner T&amp;E Forecast</h1>
      <div class="subtitle-row">
        <div class="subtitle" id="subtitle"><span class="live-dot"></span>loading…</div>
        <button class="refresh-btn" id="refreshBtn">Refresh now</button>
        <button class="clash-badge none" id="clashBadge">Checking for clashes…</button>
      </div>
    </div>
  </header>

  <div class="attention-grid" id="attentionGrid"></div>
  <div class="cost-strip" id="costStrip"></div>

  <div class="mode-switch">
    <button class="mode-btn active" id="modeConf">All Conferences</button>
    <button class="mode-btn" id="modePerson">By Person</button>
  </div>

  <div id="confView">
    <div class="search-row">
      <div class="search-box"><input type="text" id="searchInput" placeholder="Search conferences, people, roles, venues — across all regions…" autocomplete="off"></div>
      <div class="result-count" id="resultCount"></div>
    </div>
    <div class="filter-row" id="regionFilterRow"></div>
    <div class="filter-row" id="fieldChips"></div>
    <div class="sort-row" id="sortRow"></div>
    <div class="panel">
      <div class="conf-list" id="confList"></div>
      <div class="empty" id="emptyState" style="display:none;">No matching conferences — try a different search term.</div>
    </div>
  </div>

  <div id="personView" style="display:none;">
    <div class="search-row">
      <div class="search-box"><input type="text" id="personSearchInput" placeholder="Search by person name…" autocomplete="off"></div>
      <div class="result-count" id="personResultCount"></div>
    </div>
    <div class="filter-row">
      <div class="chip" id="freqOnlyChip">Show only 4+ conferences</div>
    </div>
    <div class="person-groups" id="personGroups"></div>
    <div class="empty" id="personEmptyState" style="display:none;">No matching person — try a different name.</div>
  </div>

  <footer>
    Parsed live from the source Google Sheet (region tabs, Team View, and Cost Summary). Cost totals are shown in
    each region's native currency (NA/LATAM in US$, APAC/JAPAN in AUS$, India in INR, EMEA in €) — the small
    USD-equivalent delta lets you compare regions on one basis without actually converting the totals. The
    <span class="cross-region-badge" style="margin-left:0;">⇄ REGION</span> badge marks someone whose home region
    (from "Team View") differs from the conference's region — only available for people who appear in that tab.
    Clash detection now runs across every assigned person, not just frequent travelers.
  </footer>
</div>

<script>
let RECORDS = [];
let REGIONS = [];
let HOME_REGION = {};
let COST_SUMMARY = null;
let FETCHED_AT = null;

const LIVE_DATA_URL = 'https://te-forecast-backend.vercel.app/api/te-forecast'; // <-- your live backend

const CURRENCY_LABEL = { NA: 'US$', LATAM: 'US$', APAC: 'AUS$', JAPAN: 'AUS$', INDIA: 'INR', EMEA: '€' };
const TODAY_ISO = new Date().toISOString().slice(0,10);

async function loadLiveData(forceRefresh) {
  const subtitleEl = document.getElementById('subtitle');
  const refreshBtn = document.getElementById('refreshBtn');
  refreshBtn.disabled = true;
  subtitleEl.innerHTML = '<span class="live-dot"></span>Loading latest data\\u2026';
  try {
    const url = forceRefresh ? LIVE_DATA_URL + '?refresh=true' : LIVE_DATA_URL;
    const res = await fetch(url);
    const json = await res.json();
    RECORDS = json.records || [];
    HOME_REGION = json.homeRegion || {};
    COST_SUMMARY = json.costSummary || null;
    FETCHED_AT = json.fetchedAt || null;
    REGIONS = ["NA","LATAM","EMEA","INDIA","APAC","JAPAN"].filter(r => RECORDS.some(rec => rec.region === r));
    if (activeRegions.size === 0) REGIONS.forEach(r => activeRegions.add(r));
    renderEverything();
  } catch (err) {
    subtitleEl.innerHTML = '<span class="live-dot"></span>Could not load live data \\u2014 check the connection.';
    console.error(err);
  } finally {
    refreshBtn.disabled = false;
  }
}

document.getElementById('refreshBtn').onclick = () => loadLiveData(true);

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
function fmtBudget(n) { return (n === null || n === undefined) ? '<span class="muted">—</span>' : n.toLocaleString('en-US'); }
function fmtMoney2(n, currencyLabel) {
  if (n === null || n === undefined) return '<span class="muted">—</span>';
  const formatted = n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currencyLabel ? \`\${currencyLabel} \${formatted}\` : formatted;
}
function fmtDelta2(n, currencyLabel) {
  if (n === null || n === undefined) return null;
  const sign = n > 0 ? '+' : (n < 0 ? '\\u2212' : '');
  const formatted = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return \`\${sign}\${currencyLabel ? currencyLabel + ' ' : ''}\${formatted}\`;
}
function extractConfCode(conference) {
  const m = conference && conference.match(/\\(([^)]+)\\)\\s*$/);
  return m ? m[1] : null;
}
function stripConfCode(conference) {
  return conference ? conference.replace(/\\s*\\([^)]+\\)\\s*$/, '') : conference;
}
function highlight(text, term) {
  if (!term || !text) return text || '';
  const idx = text.toLowerCase().indexOf(term.toLowerCase());
  if (idx === -1) return text;
  return text.slice(0, idx) + '<mark>' + text.slice(idx, idx + term.length) + '</mark>' + text.slice(idx + term.length);
}
function rolePriority(role) {
  const r = (role || '').toLowerCase();
  if (r.includes('reg lead')) return 0;
  if (r.includes('reg support')) return 1;
  if (r.includes('it lead')) return 2;
  if (r.includes('it support')) return 3;
  if (r.includes('zone lead')) return 5;
  return 4;
}
function findRegLead(people) {
  const lead = people.find(p => (p.role || '').toLowerCase().includes('reg lead'));
  return lead ? lead.person : null;
}
function datesOverlap(aStart, aEnd, bStart, bEnd) { return aStart <= bEnd && bStart <= aEnd; }

function computeAllClashes() {
  const byPerson = {};
  RECORDS.forEach(r => {
    if (!r.person || !r.inDate || !r.outDate) return;
    (byPerson[r.person] = byPerson[r.person] || []).push(r);
  });
  const clashesByPerson = {};
  const clashedPeople = [];
  Object.entries(byPerson).forEach(([person, records]) => {
    const clashSet = new Set();
    for (let i = 0; i < records.length; i++) {
      for (let j = i + 1; j < records.length; j++) {
        if (datesOverlap(records[i].inDate, records[i].outDate, records[j].inDate, records[j].outDate)) {
          clashSet.add(i); clashSet.add(j);
        }
      }
    }
    if (clashSet.size > 0) {
      clashesByPerson[person] = { records, clashIndices: clashSet };
      clashedPeople.push(person);
    }
  });
  return { clashesByPerson, clashedPeople };
}

function buildUnifiedConferences() {
  const map = new Map();
  RECORDS.forEach(r => {
    const key = r.region + '::' + r.conference;
    if (!map.has(key)) {
      map.set(key, {
        conference: r.conference, region: r.region, venue: r.venue,
        eventStart: r.eventStart, eventEnd: r.eventEnd, people: []
      });
    }
    map.get(key).people.push(r);
  });

  const confs = [...map.values()];
  confs.forEach(c => {
    c.code = extractConfCode(c.conference);
    c.cost = null;
    if (COST_SUMMARY && COST_SUMMARY.blocks) {
      const block = COST_SUMMARY.blocks.find(b => b.region === c.region);
      if (block) {
        const ev = block.events.find(e => e.code === c.code);
        if (ev) c.cost = ev;
      }
    }
  });
  return confs;
}

let activeRegions = new Set();
let activeFields = new Set(["conference","person","role","venue"]);
const SEARCH_LABELS = { conference: "Conference", person: "Person", role: "Role", venue: "Venue" };
let sortMode = "date";
let sortDir = 1;
let openConfs = new Set();
let currentMode = "conf";

document.getElementById('modeConf').onclick = () => setMode('conf');
document.getElementById('modePerson').onclick = () => setMode('person');
function setMode(mode) {
  currentMode = mode;
  document.getElementById('modeConf').classList.toggle('active', mode === 'conf');
  document.getElementById('modePerson').classList.toggle('active', mode === 'person');
  document.getElementById('confView').style.display = mode === 'conf' ? 'block' : 'none';
  document.getElementById('personView').style.display = mode === 'person' ? 'block' : 'none';
  if (mode === 'person') renderPersonView();
}

function renderEverything() {
  renderSubtitle();
  renderAttentionPanel();
  renderCostStrip();
  renderRegionFilters();
  renderFieldChips();
  renderSortRow();
  renderConfList();
  if (currentMode === 'person') renderPersonView();
}

function renderSubtitle() {
  const subtitleEl = document.getElementById('subtitle');
  let timeStr = '';
  if (FETCHED_AT) {
    const d = new Date(FETCHED_AT);
    timeStr = ' · refreshed ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  subtitleEl.innerHTML = \`<span class="live-dot"></span>\${REGIONS.length} regions · \${RECORDS.length} assignments · \${new Set(RECORDS.map(r=>r.conference)).size} conferences\${timeStr}\`;
}

function renderAttentionPanel() {
  const grid = document.getElementById('attentionGrid');
  const { clashesByPerson, clashedPeople } = computeAllClashes();

  const badge = document.getElementById('clashBadge');
  if (clashedPeople.length > 0) {
    badge.className = 'clash-badge';
    badge.textContent = \`⚠ \${clashedPeople.length} people with overlapping trips\`;
    badge.onclick = () => { setMode('person'); showFreqOnly = false; document.getElementById('freqOnlyChip').classList.remove('active'); renderPersonView(); window.scrollTo({top:0, behavior:'smooth'}); };
  } else {
    badge.className = 'clash-badge none';
    badge.textContent = 'No overlapping trips detected';
    badge.onclick = null;
  }

  const in14 = new Date(); in14.setDate(in14.getDate() + 14);
  const in14ISO = in14.toISOString().slice(0,10);
  const unified = buildUnifiedConferences();
  const upcoming = unified.filter(c => c.eventStart && c.eventStart >= TODAY_ISO && c.eventStart <= in14ISO)
    .sort((a,b) => a.eventStart.localeCompare(b.eventStart));

  const overall = COST_SUMMARY ? COST_SUMMARY.overallSaving : null;
  const overallKnown = overall !== null && overall !== undefined;
  const overallClass = overallKnown ? (overall > 0 ? 'positive' : (overall < 0 ? 'negative' : '')) : '';

  grid.innerHTML = \`
    <div class="attn-card \${clashedPeople.length > 0 ? 'warn' : ''}">
      <div class="attn-label">Active Clashes</div>
      <div class="attn-value \${clashedPeople.length > 0 ? 'warn' : ''}">\${clashedPeople.length}</div>
      <div class="attn-detail">
        \${clashedPeople.length === 0 ? '<span class="attn-empty">Nobody has overlapping onsite dates right now.</span>' :
          '<div class="attn-list">' + clashedPeople.slice(0,4).map(p => \`<div class="attn-list-item"><b>\${p}</b></div>\`).join('') +
          (clashedPeople.length > 4 ? \`<div class="attn-list-item">+\${clashedPeople.length - 4} more — <a onclick="setMode('person')">view all</a></div>\` : \`<div class="attn-list-item"><a onclick="setMode('person')">view details</a></div>\`) +
          '</div>'}
      </div>
    </div>
    <div class="attn-card">
      <div class="attn-label">Next 14 Days</div>
      <div class="attn-value">\${upcoming.length}</div>
      <div class="attn-detail">
        \${upcoming.length === 0 ? 'No conferences starting in this window.' :
          '<div class="attn-list">' + upcoming.slice(0,4).map(c => \`<div class="attn-list-item"><b>\${c.region}</b> \${stripConfCode(c.conference)} — \${fmtDate(c.eventStart)}</div>\`).join('') +
          (upcoming.length > 4 ? \`<div class="attn-list-item">+\${upcoming.length - 4} more</div>\` : '') + '</div>'}
      </div>
    </div>
    <div class="attn-card">
      <div class="attn-label">\${overallKnown && overall < 0 ? 'YoY Cost Increase' : 'YoY Savings So Far'}</div>
      <div class="attn-value \${overallClass}">\${overallKnown ? fmtDelta2(overall, 'US$') : 'N/A'}</div>
      <div class="attn-detail">USD-equivalent, combined across all regions vs. 2025 actuals.</div>
    </div>
  \`;
}

function renderCostStrip() {
  const strip = document.getElementById('costStrip');
  if (!COST_SUMMARY || !COST_SUMMARY.blocks || COST_SUMMARY.blocks.length === 0) {
    strip.innerHTML = '';
    return;
  }
  strip.innerHTML = '';
  REGIONS.forEach(region => {
    const block = COST_SUMMARY.blocks.find(b => b.region === region);
    const currencyLabel = CURRENCY_LABEL[region] || '';
    const displayDelta = block ? ((region === 'NA' || region === 'LATAM') ? block.nativeDelta : block.usdDelta) : null;
    const deltaClass = displayDelta === null || displayDelta === undefined ? 'none' : (displayDelta > 0 ? 'positive' : (displayDelta < 0 ? 'negative' : 'none'));
    const chip = document.createElement('div');
    chip.className = 'cost-chip';
    chip.innerHTML = \`
      <div class="region">\${region}</div>
      <div class="total">\${block ? fmtMoney2(block.total, currencyLabel) : '<span class="muted">—</span>'}</div>
      <div class="delta \${deltaClass}">\${displayDelta === null || displayDelta === undefined ? 'no comparison' : fmtDelta2(displayDelta, 'US$') + ' YoY'}</div>
    \`;
    strip.appendChild(chip);
  });
}

function renderRegionFilters() {
  const row = document.getElementById('regionFilterRow');
  row.innerHTML = '<span class="filter-label">Region:</span>';
  REGIONS.forEach(region => {
    const chip = document.createElement('div');
    chip.className = 'chip region-chip' + (activeRegions.has(region) ? ' active' : '');
    chip.textContent = region;
    chip.onclick = () => {
      if (activeRegions.has(region)) activeRegions.delete(region); else activeRegions.add(region);
      renderConfList();
      renderRegionFilters();
    };
    row.appendChild(chip);
  });
  const allBtn = document.createElement('div');
  allBtn.className = 'chip';
  allBtn.textContent = 'All';
  allBtn.onclick = () => { REGIONS.forEach(r => activeRegions.add(r)); renderConfList(); renderRegionFilters(); };
  row.appendChild(allBtn);
}

function renderFieldChips() {
  const chipsEl = document.getElementById('fieldChips');
  chipsEl.innerHTML = '<span class="filter-label">Search in:</span>';
  Object.keys(SEARCH_LABELS).forEach(field => {
    const chip = document.createElement('div');
    chip.className = 'chip' + (activeFields.has(field) ? ' active' : '');
    chip.textContent = SEARCH_LABELS[field];
    chip.onclick = () => { activeFields.has(field) ? activeFields.delete(field) : activeFields.add(field); renderConfList(); };
    chipsEl.appendChild(chip);
  });
}

function renderSortRow() {
  const sortRowEl = document.getElementById('sortRow');
  sortRowEl.innerHTML = '<span class="filter-label">Sort:</span>';
  [["date","Event date"],["name","Name"],["budget","Team budget"]].forEach(([key,lbl]) => {
    const btn = document.createElement('button');
    btn.className = 'sort-btn' + (sortMode === key ? ' active' : '');
    btn.textContent = lbl + (sortMode === key ? (sortDir === 1 ? ' ▲' : ' ▼') : '');
    btn.onclick = () => { sortDir = (sortMode === key) ? -sortDir : 1; sortMode = key; renderConfList(); };
    sortRowEl.appendChild(btn);
  });
}

function renderConfList() {
  const searchInput = document.getElementById('searchInput');
  const confListEl = document.getElementById('confList');
  const emptyState = document.getElementById('emptyState');
  const resultCount = document.getElementById('resultCount');

  const term = searchInput.value.trim().toLowerCase();
  const { clashesByPerson } = computeAllClashes();
  let confs = buildUnifiedConferences().filter(c => activeRegions.has(c.region));
  const totalAvailable = confs.length;

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
    const peopleMatch = term && c.people.some(p =>
      (activeFields.has("person") && p.person && p.person.toLowerCase().includes(term)) ||
      (activeFields.has("role") && p.role && p.role.toLowerCase().includes(term))
    );
    const isOpen = openConfs.has(key) || peopleMatch;
    const isPast = c.eventEnd && c.eventEnd < TODAY_ISO;
    const confHasClash = c.people.some(p => p.person && clashesByPerson[p.person]);

    const item = document.createElement('div');
    item.className = 'conf-item' + (isOpen ? ' open' : '') + (isPast ? ' past' : '') + (confHasClash ? ' has-clash' : '');

    const budgetTotal = c.people.reduce((s,p)=>s+(p.totalBudget||0),0);
    const regLead = findRegLead(c.people);
    const confCode = c.code;
    const confName = stripConfCode(c.conference);
    const currencyLabel = CURRENCY_LABEL[c.region] || '';

    let costHtml = '<span class="muted">no cost data</span>';
    if (c.cost) {
      const d = c.cost.delta;
      const dClass = d === null || d === undefined ? 'none' : (d > 0 ? 'positive' : (d < 0 ? 'negative' : 'none'));
      costHtml = \`\${fmtMoney2(c.cost.price2026 !== null ? c.cost.price2026 : c.cost.price2025, currencyLabel)}<div class="delta \${dClass}">\${d === null || d === undefined ? '' : fmtDelta2(d, currencyLabel) + ' YoY'}</div>\`;
    }

    const head = document.createElement('div');
    head.className = 'conf-header';
    head.innerHTML = \`
      <span class="chevron">›</span>
      <span class="region-tag">\${c.region}</span>
      <div class="conf-main">
        <div class="conf-title-row">
          <span class="conf-title">\${highlight(confName, activeFields.has("conference") ? term : "")}</span>
          \${confCode ? \`<span class="conf-code">\${confCode}</span>\` : ''}
          \${isPast ? '<span class="past-badge">Completed</span>' : ''}
          \${confHasClash ? '<span class="clash-inline-badge">⚠ clash on team</span>' : ''}
        </div>
        \${c.venue ? \`<div class="conf-venue">\${highlight(c.venue, activeFields.has("venue") ? term : "")}</div>\` : ''}
        \${regLead ? \`<div class="conf-reglead"><b>Reg Lead</b> \${regLead}</div>\` : ''}
      </div>
      <div class="conf-meta"><b>\${c.people.length}</b> on team<br>\${budgetTotal.toLocaleString('en-US')} total</div>
      <div class="conf-cost"><span class="label">Cost (2026)</span>\${costHtml}</div>
      <div class="conf-dates"><span class="label">Event</span>\${fmtDate(c.eventStart)}<span class="dash">–</span>\${fmtDateFull(c.eventEnd)}</div>
    \`;
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
    const teamSection = document.createElement('div');
    teamSection.className = 'conf-body-section';
    teamSection.innerHTML = '<div class="conf-body-heading">Team</div>';
    const table = document.createElement('table');
    table.innerHTML = \`<thead><tr><th>Person</th><th>Role</th><th>In Date</th><th>Out Date</th><th>Total Budget</th></tr></thead>\`;
    const tbody = document.createElement('tbody');
    peopleSorted.forEach(p => {
      const tr = document.createElement('tr');
      const home = p.person ? HOME_REGION[p.person] : null;
      const crossRegion = home && home !== c.region;
      const personClash = p.person && clashesByPerson[p.person];
      if (personClash) tr.className = 'clash-row';
      tr.innerHTML = \`
        <td>\${p.person ? highlight(p.person, activeFields.has("person") ? term : "") : '<span class="muted">Unassigned</span>'}\${crossRegion ? \`<span class="cross-region-badge" title="Home region: \${home}">⇄ \${home}</span>\` : ''}\${personClash ? '<span class="clash-flag">⚠ overlap</span>' : ''}</td>
        <td><span class="role-pill">\${highlight(p.role, activeFields.has("role") ? term : "")}</span></td>
        <td>\${fmtDateFull(p.inDate)}</td>
        <td>\${fmtDateFull(p.outDate)}</td>
        <td>\${fmtBudget(p.totalBudget)}</td>
      \`;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    teamSection.appendChild(table);
    body.appendChild(teamSection);

    if (c.cost) {
      const costSection = document.createElement('div');
      costSection.className = 'conf-body-section';
      costSection.innerHTML = '<div class="conf-body-heading">Cost vs. Last Year</div>';
      const costTable = document.createElement('table');
      costTable.innerHTML = \`
        <thead><tr><th>2025 Actual</th><th>2026 Actual</th><th>Delta</th></tr></thead>
        <tbody><tr>
          <td>\${fmtMoney2(c.cost.price2025, currencyLabel)}</td>
          <td>\${fmtMoney2(c.cost.price2026, currencyLabel)}</td>
          <td>\${c.cost.delta === null || c.cost.delta === undefined ? '<span class="muted">—</span>' : fmtDelta2(c.cost.delta, currencyLabel)}</td>
        </tr></tbody>
      \`;
      costSection.appendChild(costTable);
      body.appendChild(costSection);
    }

    item.appendChild(body);
    confListEl.appendChild(item);
  });

  emptyState.style.display = confs.length === 0 ? 'block' : 'none';
  resultCount.textContent = \`\${confs.length} of \${totalAvailable} conferences\`;
}

document.getElementById('searchInput').addEventListener('input', renderConfList);

let showFreqOnly = false;
document.getElementById('freqOnlyChip').onclick = function() {
  showFreqOnly = !showFreqOnly;
  this.classList.toggle('active', showFreqOnly);
  renderPersonView();
};

function renderPersonView() {
  const personSearchInput = document.getElementById('personSearchInput');
  const personGroups = document.getElementById('personGroups');
  const personEmptyState = document.getElementById('personEmptyState');
  const personResultCount = document.getElementById('personResultCount');

  const term = personSearchInput.value.trim().toLowerCase();
  const { clashesByPerson } = computeAllClashes();

  const counts = {};
  RECORDS.forEach(r => { if (r.person) counts[r.person] = (counts[r.person] || 0) + 1; });
  let people = Object.keys(counts).sort();
  if (showFreqOnly) people = people.filter(p => counts[p] > 3);
  const matched = term ? people.filter(p => p.toLowerCase().includes(term)) : people;

  matched.sort((a, b) => {
    const ac = clashesByPerson[a] ? 0 : 1;
    const bc = clashesByPerson[b] ? 0 : 1;
    if (ac !== bc) return ac - bc;
    return a.localeCompare(b);
  });

  personGroups.innerHTML = "";
  matched.forEach(person => {
    const records = RECORDS.filter(r => r.person === person).slice().sort((a,b) => (a.inDate||'').localeCompare(b.inDate||''));
    const clashInfo = clashesByPerson[person];
    const localClashSet = new Set();
    if (clashInfo) {
      for (let i = 0; i < records.length; i++) {
        for (let j = i + 1; j < records.length; j++) {
          if (!records[i].inDate || !records[i].outDate || !records[j].inDate || !records[j].outDate) continue;
          if (datesOverlap(records[i].inDate, records[i].outDate, records[j].inDate, records[j].outDate)) {
            localClashSet.add(i); localClashSet.add(j);
          }
        }
      }
    }

    const budgetTotal = records.reduce((s,r)=> s + (r.totalBudget||0), 0);
    const card = document.createElement('div');
    card.className = 'person-card';
    const head = document.createElement('div');
    head.className = 'person-card-head';
    head.innerHTML = \`
      <div>
        <div class="person-name">\${person}</div>
        <div class="person-meta">\${records.length} conference\${records.length === 1 ? '' : 's'} assigned · \${budgetTotal.toLocaleString('en-US')} total budget</div>
      </div>
      \${localClashSet.size > 0 ? \`<div class="person-warning">⚠ \${localClashSet.size} overlapping trip\${localClashSet.size===1?'':'s'}</div>\` : ''}
    \`;
    card.appendChild(head);

    const tableWrap = document.createElement('div');
    tableWrap.className = 'person-table-scroll';
    const table = document.createElement('table');
    table.innerHTML = \`<thead><tr><th>Region</th><th>Conference</th><th>Role</th><th>In Date</th><th>Out Date</th><th>Total Budget</th></tr></thead>\`;
    const tbody = document.createElement('tbody');
    records.forEach((r, i) => {
      const tr = document.createElement('tr');
      if (localClashSet.has(i)) tr.className = 'clash-row';
      tr.innerHTML = \`
        <td>\${r.region}</td>
        <td>\${r.conference}\${localClashSet.has(i) ? ' <span class="clash-flag">⚠ overlap</span>' : ''}</td>
        <td><span class="role-pill">\${r.role}</span></td>
        <td>\${fmtDateFull(r.inDate)}</td>
        <td>\${fmtDateFull(r.outDate)}</td>
        <td>\${fmtBudget(r.totalBudget)}</td>
      \`;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    tableWrap.appendChild(table);
    card.appendChild(tableWrap);
    personGroups.appendChild(card);
  });

  personEmptyState.style.display = matched.length === 0 ? 'block' : 'none';
  const clashCount = matched.filter(p => clashesByPerson[p]).length;
  personResultCount.textContent = \`\${matched.length} of \${people.length} people\` + (clashCount ? \` · \${clashCount} with overlapping trips\` : '');
}

document.getElementById('personSearchInput').addEventListener('input', renderPersonView);

loadLiveData(false);
setInterval(() => loadLiveData(false), 5 * 60 * 1000);
</script>
</body>
</html>
`;

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const auth = req.headers.authorization;
  const expectedUser = process.env.SITE_USER;
  const expectedPass = process.env.SITE_PASSWORD;

  let authorized = false;
  if (auth && auth.startsWith('Basic ')) {
    const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf8');
    const [user, pass] = decoded.split(':');
    authorized = user === expectedUser && pass === expectedPass;
  }

  if (!authorized) {
    res.setHeader('WWW-Authenticate', 'Basic realm="T&E Forecast"');
    res.status(401).send('Authentication required.');
    return;
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(PAGE_HTML);
};
