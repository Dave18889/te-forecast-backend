// Vercel serverless function: /api/te-forecast
//
// Pulls the six region tabs (NA, LATAM, EMEA, INDIA, APAC, JAPAN) plus the
// "Team View" tab from the live Google Sheet, parses the repeating
// conference blocks the same way the one-off Python extraction did, and
// returns clean JSON: { records: [...], homeRegion: {...}, fetchedAt }
//
// SETUP — see README.md for full steps:
//   1. Create a Google Cloud service account + JSON key.
//   2. Share the Google Sheet with the service account's email (Viewer).
//   3. Set env vars in Vercel:
//        GOOGLE_SERVICE_ACCOUNT_EMAIL
//        GOOGLE_PRIVATE_KEY   (keep the \n escapes from the JSON key)
//        SPREADSHEET_ID       (from the sheet's URL)
//   4. Deploy. Endpoint is live at /api/te-forecast

const { google } = require('googleapis');

const REGIONS = ['NA', 'LATAM', 'EMEA', 'INDIA', 'APAC', 'JAPAN'];
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let cache = { data: null, fetchedAt: 0 };

async function getAuthedClient() {
  const auth = new google.auth.JWT(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    null,
    (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/spreadsheets.readonly']
  );
  await auth.authorize();
  return auth;
}

function isBlankRow(row) {
  return !row || row.every(c => c === undefined || c === null || c === '');
}

// Google Sheets API returns dates as either serial numbers or formatted
// strings depending on how the range is fetched. We fetch with
// valueRenderOption FORMATTED_VALUE off (UNFORMATTED_VALUE) and
// dateTimeRenderOption SERIAL_NUMBER so dates arrive as day-count numbers,
// matching how Excel/Sheets store them internally (epoch 1899-12-30).
function serialToISO(serial) {
  if (typeof serial !== 'number') return null;
  const ms = Math.round((serial - 25569) * 86400 * 1000); // 25569 = days between 1899-12-30 and 1970-01-01
  return new Date(ms).toISOString().slice(0, 10);
}

function findHeaderMap(rows) {
  for (const row of rows) {
    if (row && row[0] === 'Role') {
      const map = {};
      row.forEach((name, i) => { if (name) map[name] = i; });
      return map;
    }
  }
  return null;
}

function parseRegionSheet(region, rows) {
  const records = [];
  const colmap = findHeaderMap(rows);
  if (!colmap) return records;

  const idxArrival = colmap['Onsite Arrival Date'];
  const idxDep = colmap['Onsite Dep. Date'];
  const idxBudget = colmap['Total Budget'];
  const idxPerson = colmap['Person'];

  let currentConf = null, currentVenue = null, currentEventDatesText = null;
  let currentEventStart = null, currentEventEnd = null;

  let i = 0;
  while (i < rows.length) {
    const row = rows[i];
    if (isBlankRow(row)) { i++; continue; }

    const headerHit = row.some(c => typeof c === 'string' && c.trim().toLowerCase().startsWith('total event days'));
    if (headerHit && row[0]) {
      currentConf = String(row[0]).trim();
      const vrow = rows[i + 1];
      if (vrow) {
        currentEventDatesText = vrow[0] || null;
        currentVenue = vrow[1] || null;
        const dateNums = vrow.filter(c => typeof c === 'number' && c > 20000 && c < 60000).sort((a,b)=>a-b);
        currentEventStart = dateNums.length ? serialToISO(dateNums[0]) : null;
        currentEventEnd = dateNums.length ? serialToISO(dateNums[dateNums.length - 1]) : null;
      }
      i += 2;
      continue;
    }

    const roleVal = row[0];
    const arrivalVal = idxArrival !== undefined ? row[idxArrival] : undefined;
    const budgetVal = idxBudget !== undefined ? row[idxBudget] : undefined;
    const personVal = idxPerson !== undefined ? row[idxPerson] : undefined;

    const arrivalEmpty = arrivalVal === undefined || arrivalVal === null || arrivalVal === '';
    const budgetPresent = typeof budgetVal === 'number';

    if (arrivalEmpty && budgetPresent) { i++; continue; } // totals row, skip
    if (!currentConf || roleVal === undefined || roleVal === null || roleVal === '') { i++; continue; }

    const depVal = idxDep !== undefined ? row[idxDep] : undefined;

    records.push({
      region,
      conference: currentConf,
      venue: currentVenue,
      eventDatesText: currentEventDatesText,
      eventStart: currentEventStart,
      eventEnd: currentEventEnd,
      role: String(roleVal).trim(),
      person: personVal ? String(personVal).trim() : null,
      inDate: typeof arrivalVal === 'number' ? serialToISO(arrivalVal) : null,
      outDate: typeof depVal === 'number' ? serialToISO(depVal) : null,
      totalBudget: typeof budgetVal === 'number' ? budgetVal : null
    });
    i++;
  }
  return records;
}

function parseTeamViewHomeRegion(rows) {
  // rows[0] is the header: NAME, REGION, CONFERENCE, ROLE, IN DATE, OUT DATE, DAYS
  const counts = {};
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[0] || !row[1]) continue;
    const name = String(row[0]).trim();
    const region = String(row[1]).trim();
    counts[name] = counts[name] || {};
    counts[name][region] = (counts[name][region] || 0) + 1;
  }
  const home = {};
  Object.entries(counts).forEach(([name, regionCounts]) => {
    let best = null, bestCount = -1;
    Object.entries(regionCounts).forEach(([region, count]) => {
      if (count > bestCount) { best = region; bestCount = count; }
    });
    home[name] = best;
  });
  return home;
}

function parseMoney(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[^0-9.\-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }
  return null;
}

const COST_REGION_MAP = { NA: 'NA', LATAM: 'LATAM', APAC: 'APAC', JAPAN: 'JAPAN', INDIA: 'INDIA', India: 'INDIA', EMEA: 'EMEA' };

function parseCostSummary(rows) {
  const blocks = [];
  let current = null;
  let overallSaving = null;
  let i = 0;

  while (i < rows.length) {
    const row = rows[i] || [];

    if (row[0] && typeof row[0] === 'string' && row[0].startsWith('Event (')) {
      const m = row[0].match(/Event \(([^)]+)\)/);
      const regionRaw = m ? m[1] : null;
      const region = COST_REGION_MAP[regionRaw] || (regionRaw ? regionRaw.toUpperCase() : null);
      const cm = row[1] && typeof row[1] === 'string' ? row[1].match(/\(([^)]+)\)/) : null;
      const currency = cm ? cm[1] : null;
      current = { region, currency, events: [], total: null, totalLabel: null, nativeDelta: null, usdDelta: null };
      blocks.push(current);
      i++;
      continue;
    }

    if (current && row[0] && typeof row[0] === 'string' && row[0].startsWith('Total')) {
      current.totalLabel = row[0];
      current.total = parseMoney(row[1]);
      current.nativeDelta = typeof row[3] === 'number' ? row[3] : null;
      const nrow = rows[i + 1] || [];
      const restEmpty = [nrow[0], nrow[1], nrow[2]].every(v => v === null || v === undefined || v === '');
      if (restEmpty && typeof nrow[3] === 'number') {
        current.usdDelta = nrow[3];
      }
      i++;
      continue;
    }

    if (row.some(c => typeof c === 'string' && c.includes('YoY Saving'))) {
      const num = row.find(c => typeof c === 'number');
      if (typeof num === 'number') overallSaving = num;
      i++;
      continue;
    }

    if (current && row[0] !== null && row[0] !== undefined && row[0] !== '') {
      current.events.push({
        code: row[0],
        price2025: parseMoney(row[1]),
        price2026: parseMoney(row[2]),
        delta: typeof row[3] === 'number' ? row[3] : null
      });
    }
    i++;
  }

  return { blocks, overallSaving };
}

module.exports = async function handler(req, res) {
  // Allow this API to be called from any webpage (needed since the frontend
  // HTML file is a different "origin" than this backend).
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const now = Date.now();
    const forceRefresh = req.query.refresh === 'true';

    if (!forceRefresh && cache.data && (now - cache.fetchedAt) < CACHE_TTL_MS) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ ...cache.data, cached: true });
    }

    const auth = await getAuthedClient();
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.SPREADSHEET_ID;

    const tabNames = [...REGIONS, 'Team View', 'Cost Summary'];
    const batch = await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: tabNames,
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'SERIAL_NUMBER'
    });

    let records = [];
    let teamViewRows = [];
    let costSummaryRows = [];
    batch.data.valueRanges.forEach((range, i) => {
      const rows = range.values || [];
      if (tabNames[i] === 'Team View') {
        teamViewRows = rows;
      } else if (tabNames[i] === 'Cost Summary') {
        costSummaryRows = rows;
      } else {
        records = records.concat(parseRegionSheet(tabNames[i], rows));
      }
    });

    const homeRegion = parseTeamViewHomeRegion(teamViewRows);
    const costSummary = parseCostSummary(costSummaryRows);

    const payload = { records, homeRegion, costSummary, fetchedAt: new Date().toISOString() };
    cache = { data: payload, fetchedAt: now };

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ...payload, cached: false });
  } catch (err) {
    console.error('te-forecast fetch failed:', err);
    return res.status(500).json({ error: 'Failed to fetch forecast data', detail: err.message });
  }
};
