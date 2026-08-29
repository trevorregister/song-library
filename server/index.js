const express = require('express');
const cors = require('cors');
const { PORT } = require('./config');
const { scrapeBulk } = require('./bulk');
const { listLibrary, resolvePdfPath } = require('./library');
const { resolveOutputDirPath, ensureWritableDir } = require('./outputDir');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Validates a client-supplied directory path before the client saves it to
// localStorage — creates it if missing and confirms it's writable. Returns
// the resolved absolute path (with `~` expanded) for the client to store.
app.post('/api/output-dir/check', (req, res) => {
  const outputDir = resolveOutputDirPath((req.body || {}).outputDir);
  if (!outputDir) {
    return res.status(400).json({ success: false, error: 'Provide a directory path.' });
  }

  try {
    ensureWritableDir(outputDir);
    res.json({ success: true, outputDir });
  } catch (err) {
    res
      .status(400)
      .json({ success: false, error: `Could not use that directory: ${err.message}` });
  }
});

app.post('/api/scrape/bulk', async (req, res) => {
  const { urls } = req.body || {};
  const outputDir = resolveOutputDirPath((req.body || {}).outputDir);

  if (!outputDir) {
    return res
      .status(400)
      .json({ success: false, error: 'Missing or invalid output directory.' });
  }

  if (!Array.isArray(urls) || urls.length === 0) {
    return res
      .status(400)
      .json({ success: false, error: 'Provide a non-empty list of URLs.' });
  }

  const cleaned = [
    ...new Set(
      urls
        .map((u) => (typeof u === 'string' ? u.trim() : ''))
        .filter(Boolean)
    ),
  ];

  if (cleaned.length === 0) {
    return res
      .status(400)
      .json({ success: false, error: 'No valid URLs were provided.' });
  }

  try {
    ensureWritableDir(outputDir);
  } catch (err) {
    return res
      .status(400)
      .json({ success: false, error: `Could not use the output directory: ${err.message}` });
  }

  try {
    const results = await scrapeBulk(cleaned, outputDir);
    res.json({ success: true, results });
  } catch (err) {
    console.error('Unexpected error during bulk scrape:', err);
    res
      .status(500)
      .json({ success: false, error: 'Unexpected server error during bulk scrape.' });
  }
});

app.get('/api/library', (req, res) => {
  const outputDir = resolveOutputDirPath(req.query.outputDir);
  if (!outputDir) {
    return res
      .status(400)
      .json({ success: false, error: 'Missing or invalid output directory.' });
  }

  try {
    res.json({ success: true, artists: listLibrary(outputDir) });
  } catch (err) {
    console.error('Error listing library:', err);
    res
      .status(500)
      .json({ success: false, error: 'Could not read the output directory.' });
  }
});

app.get('/api/library/pdf/:artist/:filename', (req, res) => {
  const outputDir = resolveOutputDirPath(req.query.outputDir);
  if (!outputDir) {
    return res
      .status(400)
      .json({ success: false, error: 'Missing or invalid output directory.' });
  }

  const filePath = resolvePdfPath(outputDir, req.params.artist, req.params.filename);
  if (!filePath) {
    return res.status(404).json({ success: false, error: 'PDF not found.' });
  }

  res.contentType('application/pdf');
  res.sendFile(filePath);
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
