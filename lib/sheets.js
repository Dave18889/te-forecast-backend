// Shared Google Sheets API access for the 2026 T&E Interface backend.
try {
  require('dotenv').config();
} catch (e) {
  // dotenv not installed / not needed (e.g. running on Vercel) — ignore.
}

const API_KEY = process.env.GOOGLE_API_KEY;
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

const REGION_TABS = ['NA', 'LATAM', 'EMEA', 'APAC', 'JAPAN', 'INDIA'];
const REGION_RANGES = REGION_TABS.map((t) => `'${t}'!A1:L500`);
const COST_SUMMARY_RANGE = `'Cost Summary'!A1:H150`;
const TEAM_VIEW_RANGE = `'Team View'!A1:G300`;

const ALL_RANGES = [...REGION_RANGES, COST_SUMMARY_RANGE, TEAM_VIEW_RANGE];

const CACHE_TTL_MS = 15 * 1000;
let cached = null;
let cachedAt = 0;

async function fetchAll() {
  if (!API_KEY || !SPREADSHEET_ID) {
    throw new Error(
      'Missing GOOGLE_API_KEY or SPREADSHEET_ID. Set them in .env locally, or in your Vercel project\'s Environment Variables.'
    );
  }

  if (cached && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cached;
  }

  const rangeParams = ALL_RANGES.map((r) => `ranges=${encodeURIComponent(r)}`).join('&');
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values:batchGet?${rangeParams}&valueRenderOption=UNFORMATTED_VALUE&key=${API_KEY}`;

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sheets API error (${res.status}): ${body}`);
  }
  const json = await res.json();
  const valueRanges = json.valueRanges || [];

  const result = { regions: {}, costSummary: [], teamView: [] };
  REGION_TABS.forEach((tab, i) => {
    result.regions[tab] = valueRanges[i]?.values || [];
  });
  result.costSummary = valueRanges[REGION_TABS.length]?.values || [];
  result.teamView = valueRanges[REGION_TABS.length + 1]?.values || [];

  cached = result;
  cachedAt = Date.now();
  return result;
}

module.exports = { fetchAll, REGION_TABS };
