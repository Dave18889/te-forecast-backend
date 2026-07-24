// Vercel serverless function: /api/te-forecast
//
// Pulls the six region tabs (NA, LATAM, EMEA, INDIA, APAC, JAPAN) plus the
// "Team View" tab from the live Google Sheet, parses the repeating
// conference blocks the same way the one-off Python extraction did, and
// returns clean JSON: { records: [...], homeRegion: {...}, fetchedAt }
//
// SETUP:
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

function serialToISO(serial) {
  if (typeof serial !== 'number') return null;
  const ms = Math.round((serial - 25569) * 86400 * 1000);
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

    if (arrivalEmpty && budgetPresent) { i++; continue; }
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

module.exports = async function handler(req, res) {
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

    const tabNames = [...REGIONS, 'Team View'];
    const batch = await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: tabNames,
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'SERIAL_NUMBER'
    });

    let records = [];
    let teamViewRows = [];
    batch.data.valueRanges.forEach((range, i) => {
      const rows = range.values || [];
      if (tabNames[i] === 'Team View') {
        teamViewRows = rows;
      } else {
        records = records.concat(parseRegionSheet(tabNames[i], rows));
      }
    });

    const homeRegion = parseTeamViewHomeRegion(teamViewRows);

    const payload = { records, homeRegion, fetchedAt: new Date().toISOString() };
    cache = { data: payload, fetchedAt: now };

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ...payload, cached: false });
  } catch (err) {
    console.error('te-forecast fetch failed:', err);
    return res.status(500).json({ error: 'Failed to fetch forecast data', detail: err.message });
  }
};
