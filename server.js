// Optional: run the same /api function locally with plain Node/Express,
// without needing the Vercel CLI.
const express = require('express');
const path = require('path');

const teForecast = require('./api/te-forecast');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/api/te-forecast', teForecast);

// Serve the static frontend files from the project root.
app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`2026 T&E Interface running at http://localhost:${PORT}`);
});
