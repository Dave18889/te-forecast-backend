const { fetchAll, REGION_TABS } = require('../lib/sheets');
const { parseRegionTab, parseCostSummary, parseTeamView } = require('../lib/parse');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const data = await fetchAll();

    const records = REGION_TABS.flatMap((tab) => parseRegionTab(tab, data.regions[tab]));
    const costSummary = parseCostSummary(data.costSummary);
    const homeRegion = parseTeamView(data.teamView);

    res.status(200).json({
      records,
      homeRegion,
      costSummary,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
