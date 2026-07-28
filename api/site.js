// Vercel serverless function: serves the T&E forecast page, but only
// after the visitor enters a username/password (checked via HTTP Basic
// Auth — the browser shows its own built-in login popup, no custom
// login page needed).

const PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>2026 Gartner T&E Forecast</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@600;700;800&family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root {
    --navy: #002856;
    --navy-deep: #001B3A;
    --accent: #C8102E;
    --bg: #FFFFFF;
    --bg-soft: #F4F6F9;
    --text: #1A2B3C;
    --text-soft: #5B6B7F;
    --text-faint: #8A97A8;
    --line: #E2E6EC;
    --clash: #C8102E;
    --clash-soft: #FCEAEC;
    --gold: #A67C27;
    --green: #1E8A4C;
    --green-soft: #E5F4EA;
    --gold-soft: #F7F0E2;
    --shadow: 0 2px 10px rgba(0,40,86,0.08);
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font-family: 'Inter', sans-serif; min-height: 100vh; }
  .wrap { max-width: 1180px; margin: 0 auto; padding: 0 24px 90px; }

  header {
    display: flex; align-items: center; justify-content: space-between;
    background: var(--navy); margin: 0 -24px 28px; padding: 38px 24px;
  }
  .header-controls { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
  .header-btn {
    font-family: 'Inter', sans-serif; font-size: 11.5px; font-weight: 600; color: #fff; background: rgba(255,255,255,0.12);
    border: 1px solid rgba(255,255,255,0.25); border-radius: 4px; padding: 8px 14px; cursor: pointer; transition: background 0.15s ease;
    white-space: nowrap;
  }
  .header-btn:hover { background: rgba(255,255,255,0.22); }
  .header-btn.active { background: #fff; color: var(--navy); border-color: #fff; }
  .clash-badge-global {
    display: inline-flex; align-items: center; gap: 6px; font-family: 'Inter', sans-serif; font-weight: 700; font-size: 12px;
    padding: 8px 14px; border-radius: 20px; cursor: pointer; border: none; white-space: nowrap;
  }
  .clash-badge-global.warn { background: var(--accent); color: #fff; }
  .clash-badge-global.clear { background: rgba(255,255,255,0.12); color: rgba(255,255,255,0.7); cursor: default; }
  h1 {
    font-family: 'Libre Franklin', sans-serif; font-weight: 800; font-size: 38px; margin: 0;
    color: #fff; letter-spacing: -0.3px;
  }
  .subtitle {
    font-size: 13px; color: rgba(255,255,255,0.68); font-family: 'IBM Plex Mono', monospace;
    margin-top: 10px; display: flex; align-items: center; gap: 7px;
  }
  .live-dot {
    width: 6px; height: 6px; border-radius: 50%; background: var(--accent); flex-shrink: 0;
    box-shadow: 0 0 0 0 rgba(200,16,46,0.5); animation: pulse 2.2s infinite;
  }
  @keyframes pulse {
    0% { box-shadow: 0 0 0 0 rgba(200,16,46,0.45); }
    70% { box-shadow: 0 0 0 6px rgba(200,16,46,0); }
    100% { box-shadow: 0 0 0 0 rgba(200,16,46,0); }
  }

  .mode-switch { display: inline-flex; background: var(--bg-soft); border: 1px solid var(--line); border-radius: 6px; padding: 3px; margin-bottom: 24px; }
  .mode-btn {
    font-family: 'Libre Franklin', sans-serif; font-weight: 700; font-size: 13.5px; padding: 9px 20px; border: none;
    background: transparent; color: var(--text-soft); border-radius: 4px; cursor: pointer; transition: all 0.15s ease;
  }
  .mode-btn.active { background: var(--navy); color: #fff; }
  .mode-btn:not(.active):hover { color: var(--navy); }

  .search-row { display: flex; gap: 12px; align-items: center; margin-bottom: 14px; }
  .search-box { flex: 1; position: relative; }
  .search-box input {
    width: 100%; padding: 11px 14px 11px 40px; font-family: 'Inter', sans-serif; font-size: 14.5px;
    border: 1.5px solid var(--line); border-radius: 4px; background: var(--bg); color: var(--text);
  }
  .search-box input::placeholder { color: var(--text-faint); }
  .search-box input:focus { outline: none; border-color: var(--navy); box-shadow: 0 0 0 3px rgba(0,40,86,0.1); }
  .search-box::before { content: ""; position: absolute; left: 14px; top: 50%; width: 13px; height: 13px; transform: translateY(-50%); border: 1.5px solid var(--text-faint); border-radius: 50%; }
  .search-box::after { content: ""; position: absolute; left: 25px; top: 61%; width: 7px; height: 1.5px; background: var(--text-faint); transform: rotate(45deg); }
  .result-count { font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; color: var(--text-soft); white-space: nowrap; }

  .field-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 24px; align-items: center; }
  .chip {
    font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 500; padding: 5px 12px; border: 1px solid var(--line);
    border-radius: 20px; background: var(--bg); color: var(--text-soft); cursor: pointer; user-select: none;
    transition: all 0.12s ease;
  }
  .chip.active { background: var(--navy); border-color: var(--navy); color: white; }

  .region-summary {
    display: flex; gap: 0; margin-bottom: 22px; background: var(--bg);
    border: 1px solid var(--line); border-top: 3px solid var(--navy); border-radius: 6px; box-shadow: var(--shadow); overflow: hidden;
  }
  .stat-card { flex: 1; padding: 18px 24px; border-right: 1px solid var(--line); }
  .stat-card:last-child { border-right: none; }
  .stat-value {
    font-family: 'IBM Plex Mono', monospace; font-weight: 600; font-size: 25px; color: var(--navy);
    letter-spacing: 0.2px; border-bottom: 2px solid var(--accent); padding-bottom: 4px; display: inline-block;
  }
  .stat-label { font-family: 'Inter', sans-serif; font-size: 10.5px; color: var(--text-soft); text-transform: uppercase; letter-spacing: 0.8px; margin-top: 8px; font-weight: 600; }

  .tabs { display: flex; gap: 10px; margin-bottom: 6px; }
  .tab {
    flex: 1; text-align: center;
    font-family: 'Libre Franklin', sans-serif; font-weight: 800; font-size: 16px; letter-spacing: 0.2px;
    padding: 15px 20px; background: var(--bg-soft); color: var(--text-soft); border: 1.5px solid var(--line);
    border-radius: 8px; cursor: pointer; transition: all 0.15s ease;
  }
  .tab .count { font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; opacity: 0.75; margin-left: 8px; font-weight: 500; }
  .tab.active { background: var(--navy); color: #fff; border-color: var(--navy); box-shadow: var(--shadow); }
  .tab:not(.active):hover { background: #E9EDF3; color: var(--navy); border-color: #C9D2DE; }

  .sort-row { display: flex; gap: 8px; padding: 14px 18px 4px; align-items: center; }
  .sort-btn {
    font-family: 'Inter', sans-serif; font-size: 11.5px; font-weight: 500; padding: 5px 11px; border: 1px solid var(--line);
    border-radius: 4px; background: var(--bg); color: var(--text-soft); cursor: pointer; transition: all 0.12s ease;
  }
  .sort-btn.active { border-color: var(--navy); color: var(--navy); font-weight: 700; }

  .panel {
    background: transparent; border: none; box-shadow: none; overflow: visible;
  }

  .conf-list { display: flex; flex-direction: column; gap: 8px; }
  .conf-item { }

  .conf-header {
    display: flex; align-items: center; gap: 18px; padding: 16px 20px; cursor: pointer;
    transition: background 0.12s ease; background: var(--bg); border: 1px solid var(--line);
    border-radius: 6px; box-shadow: var(--shadow);
  }
  .conf-header:hover { background: var(--bg-soft); }
  .conf-item.open .conf-header { background: var(--bg-soft); border-color: var(--navy); }

  .chevron {
    font-family: 'IBM Plex Mono', monospace; font-size: 15px; color: var(--accent); width: 14px; flex-shrink: 0;
    transition: transform 0.2s ease;
  }
  .conf-item.open .chevron { transform: rotate(90deg); }

  .conf-main { flex: 1; min-width: 0; }
  .conf-title-row { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
  .conf-title { font-family: 'Libre Franklin', sans-serif; font-weight: 700; font-size: 15.5px; color: var(--navy); }
  .conf-code {
    font-family: 'IBM Plex Mono', monospace; font-size: 10px; font-weight: 600; color: var(--navy);
    border: 1px solid var(--line); background: var(--bg-soft); border-radius: 3px; padding: 1px 6px; letter-spacing: 0.4px;
  }
  .conf-venue { font-family: 'Inter', sans-serif; font-size: 12px; color: var(--text-soft); margin-top: 4px; }
  .conf-reglead { font-family: 'Inter', sans-serif; font-size: 12px; color: var(--text-soft); margin-top: 4px; }
  .conf-reglead b { color: var(--navy); font-weight: 600; }
  .cross-region-badge {
    display: inline-block; margin-left: 6px; padding: 1px 7px; border-radius: 3px; font-size: 10px;
    font-family: 'IBM Plex Mono', monospace; font-weight: 600; background: var(--gold-soft); color: var(--gold); white-space: nowrap;
  }

  .conf-dates {
    font-family: 'IBM Plex Mono', monospace; font-size: 13px; color: var(--navy); white-space: nowrap; text-align: right;
  }
  .conf-dates .label { display: block; font-size: 9px; color: var(--text-faint); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px; font-family: 'Inter', sans-serif; font-weight: 600; }
  .conf-dates .dash { color: var(--accent); margin: 0 4px; }

  .past-badge {
    display: inline-block; margin-left: 2px; padding: 2px 8px; border-radius: 3px; font-size: 9px;
    font-family: 'Inter', sans-serif; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase;
    background: var(--bg-soft); color: var(--text-faint); border: 1px solid var(--line);
  }
  .conf-item.past .conf-header { background: var(--bg-soft); border-color: var(--line); opacity: 0.72; }
  .conf-item.past .conf-header:hover { opacity: 0.95; }
  .conf-item.past.open .conf-header { opacity: 1; }
  .conf-item.past .conf-title { color: var(--text-soft); }
  .conf-item.past .conf-code { color: var(--text-faint); border-color: var(--line); }

  .conf-meta { font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; color: var(--text-soft); white-space: nowrap; text-align: right; min-width: 120px; line-height: 1.5; }
  .conf-meta b { color: var(--navy); }

  .conf-body {
    max-height: 0; opacity: 0; overflow: hidden; padding: 0 20px;
    transition: max-height 0.28s ease, opacity 0.2s ease, padding 0.28s ease;
  }
  .conf-item.open .conf-body { max-height: 900px; opacity: 1; padding: 10px 20px 18px; }

  table { width: 100%; border-collapse: collapse; font-family: 'IBM Plex Mono', monospace; font-size: 12px; }
  thead th {
    text-align: left; padding: 9px 12px; font-weight: 600; font-size: 10px; letter-spacing: 0.6px;
    text-transform: uppercase; color: var(--text-faint); border-bottom: 1px solid var(--line); font-family: 'Inter', sans-serif;
  }
  tbody tr { border-bottom: 1px solid var(--line); }
  tbody tr:last-child { border-bottom: none; }
  tbody tr:hover { background: var(--bg-soft); }
  tbody td { padding: 10px 12px; color: var(--text); vertical-align: top; }
  .muted { color: var(--text-faint); }

  mark { background: #FDE9A8; color: var(--text); padding: 0 3px; border-radius: 2px; font-weight: 600; }

  .role-pill {
    display: inline-block; padding: 2px 9px; border-radius: 3px; font-size: 10.5px; font-weight: 600;
    background: #E3EBF5; color: var(--navy); white-space: nowrap; font-family: 'IBM Plex Mono', monospace;
  }

  .empty { padding: 70px 20px; text-align: center; color: var(--text-soft); font-family: 'Libre Franklin', sans-serif; font-weight: 700; font-size: 16px; }

  .person-groups { display: flex; flex-direction: column; gap: 8px; padding: 4px 0; }
  .person-item { }
  .person-header {
    display: flex; align-items: center; gap: 14px; padding: 15px 20px; cursor: pointer;
    transition: background 0.12s ease; background: var(--bg); border: 1px solid var(--line); border-radius: 6px;
    box-shadow: var(--shadow);
  }
  .person-header:hover { background: var(--bg-soft); }
  .person-item.open .person-header { background: var(--bg-soft); border-color: var(--navy); }
  .person-item.has-clash .person-header { border-left: 3px solid var(--accent); }
  .person-chevron { font-family: 'IBM Plex Mono', monospace; font-size: 15px; color: var(--accent); width: 14px; flex-shrink: 0; transition: transform 0.2s ease; }
  .person-item.open .person-chevron { transform: rotate(90deg); }
  .person-name { font-family: 'Libre Franklin', sans-serif; font-weight: 700; font-size: 15px; color: var(--navy); flex: 1.4; }
  .person-meta { font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; color: var(--text-soft); flex: 1; }
  .clash-status { font-family: 'Inter', sans-serif; font-size: 11.5px; font-weight: 700; padding: 5px 12px; border-radius: 20px; white-space: nowrap; }
  .clash-status.clear { background: var(--green-soft); color: var(--green); }
  .clash-status.warn { background: var(--clash-soft); color: var(--accent); }
  .person-body {
    max-height: 0; opacity: 0; overflow: hidden; padding: 0 20px;
    transition: max-height 0.28s ease, opacity 0.2s ease, padding 0.28s ease;
  }
  .person-item.open .person-body { max-height: 700px; opacity: 1; padding: 10px 20px 16px; overflow-y: auto; }
  .clash-row { background: var(--clash-soft); }
  .clash-row:hover { background: #F9DADD !important; }
  .clash-flag { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 700; color: var(--clash); font-family: 'IBM Plex Mono', monospace; }
  .person-table-scroll { overflow-x: auto; }

  .cost-headline {
    background: var(--navy); border-radius: 6px; padding: 22px 26px; margin-bottom: 22px;
    display: flex; align-items: center; justify-content: space-between; box-shadow: var(--shadow);
  }
  .cost-headline .label { font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.65); text-transform: uppercase; letter-spacing: 0.8px; }
  .cost-headline .value {
    font-family: 'IBM Plex Mono', monospace; font-weight: 600; font-size: 30px; color: #fff; margin-top: 4px;
  }
  .cost-headline .value.positive { color: #7FE0A8; }
  .cost-headline .value.negative { color: #FF9E9E; }
  .cost-headline .sub { font-family: 'Inter', sans-serif; font-size: 11.5px; color: rgba(255,255,255,0.6); margin-top: 6px; max-width: 340px; }

  .cost-region-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin-bottom: 20px; }
  .cost-region-card {
    background: var(--bg); border: 1px solid var(--line); border-top: 3px solid var(--navy);
    border-radius: 6px; box-shadow: var(--shadow); overflow: hidden;
  }
  .cost-region-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; cursor: pointer; transition: background 0.12s ease; }
  .cost-region-head:hover { background: var(--bg-soft); }
  .cost-region-card.open .cost-region-head { background: var(--bg-soft); }
  .cost-region-name { font-family: 'Libre Franklin', sans-serif; font-weight: 700; font-size: 15px; color: var(--navy); display: flex; align-items: center; gap: 8px; }
  .cost-region-total { font-family: 'IBM Plex Mono', monospace; font-weight: 600; font-size: 17px; color: var(--text); margin-top: 6px; }
  .cost-region-delta { font-family: 'IBM Plex Mono', monospace; font-size: 12px; margin-top: 4px; }
  .cost-region-delta.positive { color: #1E8A4C; }
  .cost-region-delta.negative { color: var(--clash); }
  .cost-region-delta.none { color: var(--text-faint); }
  .cost-chevron { font-family: 'IBM Plex Mono', monospace; font-size: 15px; color: var(--accent); transition: transform 0.2s ease; }
  .cost-region-card.open .cost-chevron { transform: rotate(90deg); }
  .cost-region-body {
    max-height: 0; opacity: 0; overflow: hidden; padding: 0 20px;
    transition: max-height 0.28s ease, opacity 0.2s ease, padding 0.28s ease;
  }
  .cost-region-card.open .cost-region-body { max-height: 600px; opacity: 1; padding: 0 20px 16px; overflow-y: auto; }

  .cost-note {
    font-family: 'Inter', sans-serif; font-size: 11.5px; color: var(--text-soft); line-height: 1.6;
    background: var(--bg-soft); border: 1px solid var(--line); border-radius: 6px; padding: 14px 18px;
  }

  .days-until-badge {
    display: inline-block; margin-left: 6px; padding: 1px 7px; border-radius: 3px; font-size: 10px;
    font-family: 'IBM Plex Mono', monospace; font-weight: 700; background: #E3EBF5; color: var(--navy); white-space: nowrap;
  }
  .export-btn {
    font-family: 'Inter', sans-serif; font-size: 11.5px; font-weight: 600; color: var(--navy); background: var(--bg);
    border: 1px solid var(--line); border-radius: 4px; padding: 6px 13px; cursor: pointer; transition: background 0.15s ease;
    white-space: nowrap;
  }
  .export-btn:hover { background: var(--bg-soft); }

  .sort-export-row { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px 4px; }
  .cost-export-row { display: flex; justify-content: flex-end; margin-bottom: 12px; }

  footer {
    margin-top: 22px; font-family: 'Inter', sans-serif; font-size: 11.5px; color: var(--text-faint);
    line-height: 1.7; border-top: 1px solid var(--line); padding-top: 18px;
  }
/* ==================== Mobile ==================== */
@media (max-width: 700px) {
  .wrap { padding: 0 14px 60px; }

  header {
    flex-direction: column; align-items: flex-start; gap: 16px;
    margin: 0 -14px 20px; padding: 22px 16px;
  }
  h1 { font-size: 23px; }
  .header-controls { width: 100%; flex-wrap: wrap; gap: 8px; }
  .header-btn, .clash-badge-global { flex: 1 1 auto; text-align: center; font-size: 11px; padding: 9px 10px; }

  .mode-switch { width: 100%; }
  .mode-btn { flex: 1; font-size: 12px; padding: 9px 8px; }

  .tabs { flex-wrap: wrap; }
  .tab { flex: 1 1 calc(33.333% - 7px); font-size: 13px; padding: 12px 8px; }

  .region-summary, .cost-region-grid { display: block; }
  .region-summary .stat-card {
    border-right: none; border-bottom: 1px solid var(--line); padding: 14px 16px;
  }
  .region-summary .stat-card:last-child { border-bottom: none; }
  .cost-region-grid .cost-region-card { margin-bottom: 10px; }

  .search-row { flex-wrap: wrap; }
  .search-box { flex-basis: 100%; }
  .result-count { width: 100%; }

  .sort-export-row { flex-direction: column; align-items: stretch; gap: 10px; padding: 14px 4px 4px; }
  .sort-row { flex-wrap: wrap; }
  #exportBrowseBtn, #exportCostBtn { width: 100%; }
  .cost-export-row { justify-content: stretch; }

  /* Stack conference rows vertically instead of a wide horizontal line */
  .conf-header {
    flex-direction: column; align-items: flex-start; gap: 10px; padding: 14px 16px;
  }
  .chevron { position: absolute; right: 16px; top: 14px; }
  .conf-header { position: relative; padding-right: 40px; }
  .conf-main, .conf-meta, .conf-dates { flex: none; width: 100%; text-align: left; }
  .conf-meta, .conf-dates { display: flex; justify-content: space-between; align-items: baseline; }
  .conf-dates .label { display: inline; margin-right: 6px; }
  .conf-body { padding: 0 16px; }
  .conf-item.open .conf-body { padding: 10px 16px 16px; }

  /* Stack person rows the same way */
  .person-header {
    flex-direction: column; align-items: flex-start; gap: 8px; padding: 14px 16px; position: relative; padding-right: 40px;
  }
  .person-chevron { position: absolute; right: 16px; top: 16px; }
  .person-name, .person-meta, .clash-status { width: 100%; }
  .clash-status { display: inline-block; width: auto; }

  table { font-size: 11px; }
  thead th, tbody td { padding: 7px 8px; }

  .cost-headline { flex-direction: column; align-items: flex-start; gap: 10px; }
}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div>
      <h1>GPJ 2026 Gartner T&amp;E Forecast</h1>
      <div class="subtitle" id="subtitle"><span class="live-dot"></span>loading…</div>
    </div>
    <div class="header-controls">
      <button class="header-btn" id="usdToggle">Show in USD</button>
      <button class="clash-badge-global clear" id="clashBadgeGlobal">Checking for clashes…</button>
    </div>
  </header>

  <div class="mode-switch">
    <button class="mode-btn active" id="modeBrowse">Browse by region</button>
    <button class="mode-btn" id="modePerson">By person / clash check</button>
    <button class="mode-btn" id="modeCost">Cost Summary</button>
  </div>

  <div id="browseView">
    <div class="tabs" id="tabs"></div>
    <div class="region-summary" id="regionSummary"></div>
    <div class="search-row">
      <div class="search-box"><input type="text" id="searchInput" placeholder="Search conferences, people, roles…" autocomplete="off"></div>
      <div class="result-count" id="resultCount"></div>
    </div>
    <div class="field-chips" id="fieldChips"></div>
    <div class="panel">
      <div class="sort-export-row">
        <div class="sort-row" id="sortRow" style="padding:0; margin-bottom:0;"></div>
        <button class="export-btn" id="exportBrowseBtn">Export CSV</button>
      </div>
      <div class="conf-list" id="confList"></div>
      <div class="empty" id="emptyState" style="display:none;">No matching conferences — try a different search term.</div>
    </div>
  </div>

  <div id="personView" style="display:none;">
    <div class="search-row">
      <div class="search-box"><input type="text" id="personSearchInput" placeholder="Search by person name…" autocomplete="off"></div>
      <div class="result-count" id="personResultCount"></div>
    </div>
    <div class="filter-row" style="margin-bottom:12px;"><button class="export-btn" id="exportPersonBtn">Export CSV</button></div>
    <div class="person-groups" id="personGroups"></div>
    <div class="empty" id="personEmptyState" style="display:none;">No matching person — try a different name.</div>
  </div>

  <div id="costView" style="display:none;">
    <div class="cost-headline" id="costHeadline"></div>
    <div class="cost-export-row"><button class="export-btn" id="exportCostBtn">Export CSV</button></div>
    <div class="cost-region-grid" id="costRegionGrid"></div>
    <div class="cost-note">
      Figures are pulled directly from the "Cost Summary" tab in the source sheet, which compares each
      conference's actual 2025 spend to its 2026 forecast. Totals are shown in each region's native currency
      as entered in the sheet (NA and LATAM in $; APAC and JAPAN in AUS$; India in INR; EMEA in €). Note that
      Team Budget figures elsewhere on the site (Browse by region, By Person) use a different source dataset —
      EMEA's Team Budget figures are in £ (GBP), not €, confirmed against the client's approved 2026 peg rates.
      The small USD-equivalent delta lets you compare regions on the same basis even though the totals themselves
      aren't converted. LATAM has no year-over-year comparison since most of its conferences don't yet have a
      matching 2025 actual on record.
    </div>
  </div>

  <footer>
    Parsed from your uploaded 2026 Gartner T&amp;E Forecast workbook (NA, LATAM, EMEA, INDIA, APAC, JAPAN tabs).
    "Total Budget" is shown exactly as entered in the source sheet — note India's figures appear to be in a
    different currency scale (likely INR) than the other regions, so don't sum across regions without checking.
    Rows with no onsite dates are excluded from the clash check since there's nothing to compare.
    Within each expanded conference, the team is ordered Reg Lead → Reg Support → IT Lead → IT Support → other
    roles → Zone Leads. The <span class="cross-region-badge" style="margin-left:0;">⇄ REGION</span> badge marks
    someone whose home region (from the "Team View" tab) differs from the conference's region — this is only
    shown for the ~49 people who appear in that tab; others can't be checked against it.
  </footer>
</div>

<script>
let RECORDS = [];
let REGIONS = [];
let HOME_REGION = {};
let COST_SUMMARY = null;

const LIVE_DATA_URL = 'https://te-forecast-backend.vercel.app/api/te-forecast'; // <-- your live backend

async function loadLiveData() {
  const subtitleEl = document.getElementById('subtitle');
  subtitleEl.textContent = 'Loading latest data\\u2026';
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
    subtitleEl.textContent = 'Could not load live data \\u2014 check the connection.';
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

subtitle.innerHTML = \`<span class="live-dot"></span>\${REGIONS.length} region sheets · \${RECORDS.length} assignments · \${new Set(RECORDS.filter(r => !isAirport(r.conference)).map(r=>r.conference)).size} conferences\`;

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
  return currencyLabel ? \`\${currencyLabel} \${formatted}\` : formatted;
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
  return currencyLabel ? \`\${currencyLabel} \${formatted}\` : formatted;
}

function fmtDelta2(n, currencyLabel) {
  if (n === null || n === undefined) return null;
  const sign = n > 0 ? '+' : (n < 0 ? '\\u2212' : '');
  const formatted = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return \`\${sign}\${currencyLabel ? currencyLabel + ' ' : ''}\${formatted}\`;
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
    headlineEl.innerHTML = \`
      <div>
        <div class="label">Cost Summary</div>
        <div class="value" style="font-size:16px;">No cost data was returned from the sheet.</div>
        <div class="sub">Check that the "Cost Summary" tab still exists with that exact name, and that its rows follow the "Event (REGION)" block layout the parser expects.</div>
      </div>
    \`;
    gridEl.innerHTML = "";
    return;
  }

  const totalsPresent = COST_SUMMARY.blocks.some(b => b.total !== null && b.total !== undefined);

  const overall = COST_SUMMARY.overallSaving;
  const overallKnown = overall !== null && overall !== undefined;
  const overallClass = overallKnown ? (overall > 0 ? 'positive' : (overall < 0 ? 'negative' : '')) : '';
  const overallLabel = !overallKnown ? 'YoY Change So Far' : (overall > 0 ? 'YoY Savings So Far (USD-equivalent)' : 'YoY Cost Increase So Far (USD-equivalent)');
  const overallValue = overallKnown ? fmtDelta2(overall, 'US$') : 'Not available';

  headlineEl.innerHTML = \`
    <div>
      <div class="label">\${overallLabel}</div>
      <div class="value \${overallClass}">\${overallValue}</div>
      <div class="sub">Combines each region's year-over-year change, converted to a common USD basis so regions in different currencies can be compared on one line.
      \${!totalsPresent ? ' No region totals parsed from the sheet — the "Total" row label or column layout may differ from what the parser expects.' : ''}</div>
    </div>
  \`;

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
      : \`\${costDeltaDisplay(computedDelta, block.region, currencyLabel)} YoY\`;

    const card = document.createElement('div');
    card.className = 'cost-region-card' + (isOpen ? ' open' : '');

    const head = document.createElement('div');
    head.className = 'cost-region-head';
    head.innerHTML = \`
      <div>
        <div class="cost-region-name">\${block.region}</div>
        <div class="cost-region-total">\${costDisplay(computedTotal2025, block.region, currencyLabel)}</div>
        <div class="cost-region-delta \${deltaClass}">\${deltaText}</div>
      </div>
      <span class="cost-chevron">›</span>
    \`;
    head.onclick = () => {
      if (openCostRegions.has(block.region)) openCostRegions.delete(block.region);
      else openCostRegions.add(block.region);
      renderCostView();
    };
    card.appendChild(head);

    const body = document.createElement('div');
    body.className = 'cost-region-body';
    const table = document.createElement('table');
    table.innerHTML = \`<thead><tr><th>Conference</th><th>T&E Forecast</th><th>2025 Actual</th><th>2026 Actual</th><th>YoY Delta</th></tr></thead>\`;
    const tbody = document.createElement('tbody');
    let teamForecastTotal = 0;
    let anyTeamForecastPresent = false;
    block.events.forEach(ev => {
      const teamForecast = teamBudgetForConference(block.region, ev.code);
      if (teamForecast !== null) { teamForecastTotal += teamForecast; anyTeamForecastPresent = true; }
      const tr = document.createElement('tr');
      tr.innerHTML = \`
        <td>\${ev.code}</td>
        <td>\${teamForecast !== null ? budgetDisplay(teamForecast, block.region) : '<span class="muted">—</span>'}</td>
        <td>\${costDisplay(ev.price2025, block.region, currencyLabel)}</td>
        <td>\${costDisplay(ev.price2026, block.region, currencyLabel)}</td>
        <td>\${ev.delta === null || ev.delta === undefined ? '<span class="muted">—</span>' : costDeltaDisplay(ev.delta, block.region, currencyLabel)}</td>
      \`;
      tbody.appendChild(tr);
    });

    const totalsTr = document.createElement('tr');
    totalsTr.style.borderTop = '2px solid var(--navy)';
    totalsTr.style.fontWeight = '700';
    totalsTr.innerHTML = \`
      <td><b>Total</b></td>
      <td><b>\${anyTeamForecastPresent ? budgetDisplay(teamForecastTotal, block.region) : '<span class="muted">—</span>'}</b></td>
      <td><b>\${costDisplay(computedTotal2025, block.region, currencyLabel)}</b></td>
      <td><b>\${anyPrice2026Present ? costDisplay(computedTotal2026, block.region, currencyLabel) : '<span class="muted">—</span>'}</b></td>
      <td><b>\${anyDeltaPresent ? costDeltaDisplay(computedDelta, block.region, currencyLabel) : '<span class="muted">—</span>'}</b></td>
    \`;
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
    btn.innerHTML = \`\${region} <span class="count">\${confCount}</span>\`;
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

  regionSummaryEl.innerHTML = \`
    <div class="stat-card">
      <div class="stat-value">\${budgetDisplay(totalCost, currentRegion)}</div>
      <div class="stat-label">Total forecasted cost</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">\${uniquePeople}</div>
      <div class="stat-label">Unique team members</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">\${confCount}</div>
      <div class="stat-label">Conferences</div>
    </div>
  \`;
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

// "Airport" entries are satellite/logistics assignments tied to an existing
// conference (same code, e.g. SYM36 appears as both the main conference and
// an "Airport" variant) — not a standalone conference, so they're excluded
// from conference lists, counts, and clash detection.
function isAirport(conference) {
  return /airport/i.test(conference || '');
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
      else if (daysUntil > 0) daysUntilBadge = \`<span class="days-until-badge">in \${daysUntil} day\${daysUntil === 1 ? '' : 's'}</span>\`;
    }

    const head = document.createElement('div');
    head.className = 'conf-header';
    head.innerHTML = \`
      <span class="chevron">›</span>
      <div class="conf-main">
        <div class="conf-title-row">
          <span class="conf-title">\${highlight(confName, activeFields.has("conference") ? term : "")}</span>
          \${confCode ? \`<span class="conf-code">\${confCode}</span>\` : ''}
          \${isPast ? '<span class="past-badge">Completed</span>' : ''}
          \${daysUntilBadge}
        </div>
        \${c.venue ? \`<div class="conf-venue">\${highlight(c.venue, activeFields.has("venue") ? term : "")}</div>\` : ''}
        \${regLead ? \`<div class="conf-reglead"><b>Reg Lead</b> \${regLead}</div>\` : ''}
      </div>
      <div class="conf-meta"><b>\${c.people.length}</b> on team<br>\${budgetDisplay(budgetTotal, c.region)} total</div>
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
    const table = document.createElement('table');
    table.innerHTML = \`<thead><tr><th>Person</th><th>Role</th><th>In Date</th><th>Out Date</th><th>Total Budget</th></tr></thead>\`;
    const tbody = document.createElement('tbody');
    peopleSorted.forEach(p => {
      const tr = document.createElement('tr');
      const home = p.person ? HOME_REGION[p.person] : null;
      const crossRegion = home && home !== c.region;
      tr.innerHTML = \`
        <td>\${p.person ? highlight(p.person, activeFields.has("person") ? term : "") : '<span class="muted">Unassigned</span>'}\${crossRegion ? \`<span class="cross-region-badge" title="Home region: \${home}">⇄ \${home}</span>\` : ''}</td>
        <td><span class="role-pill">\${highlight(p.role, activeFields.has("role") ? term : "")}</span></td>
        <td>\${fmtDateFull(p.inDate)}</td>
        <td>\${fmtDateFull(p.outDate)}</td>
        <td>\${budgetDisplay(p.totalBudget, c.region)}</td>
      \`;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    body.appendChild(table);
    item.appendChild(body);

    confListEl.appendChild(item);
  });

  emptyState.style.display = confs.length === 0 ? 'block' : 'none';
  resultCount.textContent = \`\${confs.length} of \${groupConferences(currentRegion).filter(c => !isAirport(c.conference)).length} conferences\`;
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

function computeClashes(records) {
  const clashSet = new Set();
  for (let i = 0; i < records.length; i++) {
    if (!records[i].inDate || !records[i].outDate) continue;
    if (excludedFromClash(records[i])) continue;
    for (let j = i + 1; j < records.length; j++) {
      if (!records[j].inDate || !records[j].outDate) continue;
      if (excludedFromClash(records[j])) continue;
      if (datesOverlap(records[i].inDate, records[i].outDate, records[j].inDate, records[j].outDate)) {
        clashSet.add(i); clashSet.add(j);
      }
    }
  }
  return clashSet;
}

// Runs across EVERY assigned person, regardless of how many conferences they
// have — used for the always-visible header badge so a clash is never hidden
// behind the By Person tab's 4+ filter.
function computeGlobalClashCount() {
  const byPerson = {};
  RECORDS.forEach(r => {
    if (!r.person || !r.inDate || !r.outDate) return;
    (byPerson[r.person] = byPerson[r.person] || []).push(r);
  });
  let count = 0;
  Object.values(byPerson).forEach(records => {
    if (computeClashes(records).size > 0) count++;
  });
  return count;
}

function renderGlobalClashBadge() {
  const badge = document.getElementById('clashBadgeGlobal');
  const count = computeGlobalClashCount();
  if (count > 0) {
    badge.className = 'clash-badge-global warn';
    badge.textContent = \`⚠ \${count} people with overlapping trips\`;
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
    return /[",\\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [headers.map(escape).join(',')].concat(rows.map(r => r.map(escape).join(',')));
  const blob = new Blob([lines.join('\\n')], { type: 'text/csv;charset=utf-8;' });
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
  downloadCSV(\`\${currentRegion}-conferences.csv\`,
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
    const clashSet = computeClashes(records);
    records.forEach((r, i) => {
      rows.push([person, r.region, r.conference, r.role, r.inDate || '', r.outDate || '',
        r.totalBudget !== null && r.totalBudget !== undefined ? r.totalBudget : '', BUDGET_CURRENCY_LABEL[r.region] || '',
        clashSet.has(i) ? 'Yes' : 'No']);
    });
  });
  downloadCSV('people-conferences.csv',
    ['Person','Region','Conference','Role','In Date','Out Date','Total Budget','Currency','Overlaps Another Trip'],
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
    const clashSet = computeClashes(records);
    const hasClash = clashSet.size > 0;
    if (hasClash) totalClashCount++;
    const isOpen = openPersons.has(person);

    const budgetTotal = records.reduce((s,r)=> s + (r.totalBudget||0), 0);
    const distinctRegions = new Set(records.map(r => r.region));
    let budgetTotalText;
    if (showUSD) {
      const usdSum = records.reduce((s,r) => s + (convertIfNeeded(r.totalBudget, BUDGET_CURRENCY_CODE[r.region]) || 0), 0);
      budgetTotalText = \`US$ \${usdSum.toLocaleString('en-US')}\`;
    } else {
      const aggCurrency = distinctRegions.size === 1 ? (BUDGET_CURRENCY_LABEL[records[0].region] || '') : null;
      budgetTotalText = aggCurrency
        ? \`\${aggCurrency} \${budgetTotal.toLocaleString('en-US')}\`
        : \`\${budgetTotal.toLocaleString('en-US')} (mixed currencies)\`;
    }

    // Total travel days: sum of onsite nights across all trips (simple sum, not
    // de-duplicated for overlaps — clashes are already flagged separately above).
    const totalTravelDays = records.reduce((s,r) => {
      if (!r.inDate || !r.outDate) return s;
      const days = Math.round((new Date(r.outDate) - new Date(r.inDate)) / 86400000) + 1;
      return s + Math.max(days, 0);
    }, 0);

    const item = document.createElement('div');
    item.className = 'person-item' + (isOpen ? ' open' : '') + (hasClash ? ' has-clash' : '');

    const header = document.createElement('div');
    header.className = 'person-header';
    header.innerHTML = \`
      <span class="person-chevron">›</span>
      <div class="person-name">\${person}</div>
      <div class="person-meta">\${records.length} conference\${records.length === 1 ? '' : 's'} · \${totalTravelDays} travel day\${totalTravelDays === 1 ? '' : 's'} · \${budgetTotalText} total</div>
      <div class="clash-status \${hasClash ? 'warn' : 'clear'}">\${hasClash ? \`⚠ \${clashSet.size} overlapping trip\${clashSet.size===1?'':'s'}\` : '✓ No clashes'}</div>
    \`;
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
    table.innerHTML = \`<thead><tr><th>Region</th><th>Conference</th><th>Role</th><th>In Date</th><th>Out Date</th><th>Total Budget</th></tr></thead>\`;
    const tbody = document.createElement('tbody');
    records.forEach((r, i) => {
      const tr = document.createElement('tr');
      if (clashSet.has(i)) tr.className = 'clash-row';
      tr.innerHTML = \`
        <td>\${r.region}</td>
        <td>\${r.conference}\${clashSet.has(i) ? ' <span class="clash-flag">⚠ overlap</span>' : ''}</td>
        <td><span class="role-pill">\${r.role}</span></td>
        <td>\${fmtDateFull(r.inDate)}</td>
        <td>\${fmtDateFull(r.outDate)}</td>
        <td>\${budgetDisplay(r.totalBudget, r.region)}</td>
      \`;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    tableWrap.appendChild(table);
    body.appendChild(tableWrap);
    item.appendChild(body);

    personGroups.appendChild(item);
  });

  personEmptyState.style.display = matched.length === 0 ? 'block' : 'none';
  personResultCount.textContent = \`\${matched.length} of \${people.length} people with 4+ conferences\` + (totalClashCount ? \` · \${totalClashCount} with overlapping trips\` : '');
}

personSearchInput.addEventListener('input', renderPersonView);

loadLiveData();
// Refresh automatically every 5 minutes while the page is open
setInterval(loadLiveData, 5 * 60 * 1000);
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
