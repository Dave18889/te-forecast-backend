// Parsing logic for the 2026 Gartner T&E Forecast sheet, rebuilt to match
// the RECORDS / homeRegion / costSummary shape the existing frontend
// (te-forecast.js) expects. Tested against a real export of the sheet.

function serialToISODate(serial) {
  if (typeof serial !== 'number') return null;
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  return new Date(ms).toISOString().slice(0, 10);
}

// --- Parse a single region tab (NA, LATAM, EMEA, APAC, JAPAN, INDIA) ---
// Layout: some notes rows, a header row ("Role" in column A), then
// repeating conference blocks: a title row (conference name + code,
// combined, no fixed prefix character), a "dates" row (a human-readable
// date-range string, the venue, and — at a position that shifts slightly
// per region — the actual event start/end dates), then one row per role
// until a "total" row (identified by having no arrival/departure/person
// but a numeric Total Budget) or a blank row.
function parseRegionTab(tabKey, rows) {
  const records = [];
  if (!rows || rows.length === 0) return records;

  const headerIdx = rows.findIndex((r) => (r[0] || '').toString().trim() === 'Role');
  if (headerIdx < 0) return records;
  const header = rows[headerIdx];
  const colIndex = (predicate) => header.findIndex((h) => predicate((h || '').toString().trim()));

  const arrivalCol = colIndex((h) => h.startsWith('Onsite Arrival'));
  const depCol = colIndex((h) => h.startsWith('Onsite Dep'));
  const flightCol = colIndex((h) => h.startsWith('Flight Budget'));
  const perDiemCol = colIndex((h) => h.startsWith('Per Diem'));
  const otherCol = colIndex((h) => h.startsWith('Other'));
  const totalCol = colIndex((h) => h.startsWith('Total Budget'));
  const personCol = colIndex((h) => h.startsWith('Person'));

  const isEmpty = (v) => v === null || v === undefined || v === '';
  const isTotalRow = (row) =>
    isEmpty(row[arrivalCol]) &&
    isEmpty(row[depCol]) &&
    isEmpty(row[personCol]) &&
    typeof row[totalCol] === 'number' &&
    row[totalCol] > 0; // a genuine block-total is always positive; an unassigned
    // $0 role row (e.g. a cancelled conference's empty slots) must not be
    // mistaken for the block's summary row.

  let i = headerIdx + 1;
  while (i < rows.length) {
    const row = rows[i] || [];
    const titleCell = row[0];

    if (titleCell !== null && titleCell !== undefined && String(titleCell).trim() !== '') {
      const conference = String(titleCell).trim();

      const datesRow = rows[i + 1] || [];
      const eventDatesText = datesRow[0] || null;
      const venue = datesRow[1] || null;
      // The event start/end dates land in slightly different columns per
      // region (depending on whether that region has a "Hotel" column) —
      // rather than hardcode a position, take the first two non-null
      // values found after the date-range text and venue columns.
      const restOfRow = datesRow.slice(2).filter((v) => v !== null && v !== undefined && v !== '');
      const eventStart = serialToISODate(restOfRow[0]);
      const eventEnd = serialToISODate(restOfRow[1]);

      let r = i + 2;
      while (r < rows.length && rows[r] && rows[r][0] !== null && rows[r][0] !== undefined && String(rows[r][0]).trim() !== '') {
        if (isTotalRow(rows[r])) {
          r++;
          break;
        }
        const dr = rows[r];
        records.push({
          region: tabKey,
          conference,
          venue,
          eventStart,
          eventEnd,
          eventDatesText,
          person: dr[personCol] || null,
          role: (dr[0] || '').toString().trim(),
          inDate: serialToISODate(dr[arrivalCol]),
          outDate: serialToISODate(dr[depCol]),
          totalBudget: typeof dr[totalCol] === 'number' ? dr[totalCol] : null,
        });
        r++;
      }

      i = r;
      while (i < rows.length && (!rows[i] || rows[i][0] === null || rows[i][0] === undefined || String(rows[i][0]).trim() === '')) i++;
    } else {
      i++;
    }
  }

  return records;
}

// --- Parse the "Cost Summary" tab ---
// Repeating blocks: an "Event (REGION)" header row (with currency stated
// in the neighboring column headers), then one row per conference code
// with 2025/2026 actual prices and a delta, until a row starting with
// "Total" (skipped — the frontend recomputes totals itself from the
// visible events rather than trusting this row, since it's proven
// unreliable). Prices are sometimes plain numbers, sometimes formatted
// strings like "$ 141,136.39" or "INR  1,316,529.39", and sometimes "New"
// or "N/A" for events with no prior-year data.
function parsePrice(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const cleaned = v.replace(/[^0-9.-]/g, '');
    if (cleaned === '' || cleaned === '-') return null;
    const n = parseFloat(cleaned);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

function parseCostSummary(rows) {
  const blocks = [];
  if (!rows || rows.length === 0) return { blocks, overallSaving: null };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];
    const label = (row[0] || '').toString();
    const match = /^Event\s*\(([^)]+)\)/i.exec(label);
    if (!match) continue;

    const region = match[1].trim().toUpperCase();
    const currencyMatch = /\(([^)]+)\)/.exec((row[1] || '').toString());
    const currency = currencyMatch ? currencyMatch[1] : null;

    const events = [];
    let r = i + 1;
    while (r < rows.length) {
      const er = rows[r] || [];
      const code = er[0];
      if (code === null || code === undefined || String(code).trim() === '') {
        r++;
        continue; // skip stray/blank rows without ending the block
      }
      if (/^total/i.test(String(code).trim())) {
        r++;
        break;
      }
      events.push({
        code: String(code).trim(),
        price2025: parsePrice(er[1]),
        price2026: parsePrice(er[2]),
        delta: parsePrice(er[3]),
      });
      r++;
      // Stop if we've hit the next "Event (...)" header without a Total row in between.
      if (/^Event\s*\(/i.test((rows[r] && rows[r][0]) || '')) break;
    }

    blocks.push({ region, currency, events });
    i = r - 1; // outer loop's i++ will continue from here
  }

  // The sheet states its own running total, e.g. a row with a numeric
  // value next to a "YoY Saving So Far" label — read it directly rather
  // than recomputing, since it may account for figures not itemized above.
  let overallSaving = null;
  for (const row of rows) {
    if (row.some((c) => typeof c === 'string' && /saving/i.test(c))) {
      const numCell = row.find((c) => typeof c === 'number');
      if (typeof numCell === 'number') {
        overallSaving = numCell;
        break;
      }
    }
  }

  return { blocks, overallSaving };
}

// --- Parse the "Team View" tab into a { name: homeRegion } map ---
// One row per person per conference (a person can appear many times,
// across different regions if they travel cross-region). Home region is
// taken as the most frequent region across all of that person's rows.
function parseTeamView(rows) {
  if (!rows || rows.length === 0) return {};
  const headerIdx = rows.findIndex((r) => (r[0] || '').toString().trim().toUpperCase() === 'NAME');
  const dataRows = headerIdx >= 0 ? rows.slice(headerIdx + 1) : rows;

  const counts = {}; // name -> { region: count }
  dataRows.forEach((row) => {
    const name = (row[0] || '').toString().trim();
    const region = (row[1] || '').toString().trim().toUpperCase();
    if (!name || !region) return;
    counts[name] = counts[name] || {};
    counts[name][region] = (counts[name][region] || 0) + 1;
  });

  const homeRegion = {};
  Object.entries(counts).forEach(([name, regionCounts]) => {
    let best = null;
    let bestCount = -1;
    Object.entries(regionCounts).forEach(([region, count]) => {
      if (count > bestCount) {
        best = region;
        bestCount = count;
      }
    });
    homeRegion[name] = best;
  });

  return homeRegion;
}

module.exports = { parseRegionTab, parseCostSummary, parseTeamView };
