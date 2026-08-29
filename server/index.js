const express = require('express');
const cors = require('cors');
const { PORT } = require('./config');
const { scrapeTab, ScrapeError } = require('./scraper');
const { parseContent } = require('./parser');
const { createTabPdf } = require('./pdfGen');
const { scrapeBulk } = require('./bulk');
const { listLibrary, resolvePdfPath } = require('./library');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/scrape', async (req, res) => {
  const { url } = req.body || {};

  try {
    const { content, title, artist } = await scrapeTab(url);
    const blocks = parseContent(content);
    const { filename, path: filePath } = await createTabPdf({
      title,
      artist,
      blocks,
    });

    res.json({ success: true, filename, path: filePath });
  } catch (err) {
    if (err instanceof ScrapeError) {
      return res.status(err.status).json({ success: false, error: err.message });
    }
    console.error('Unexpected error during scrape:', err);
    res
      .status(500)
      .json({ success: false, error: 'Unexpected server error while generating the PDF.' });
  }
});

app.post('/api/scrape/bulk', async (req, res) => {
  const { urls } = req.body || {};

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
    const results = await scrapeBulk(cleaned);
    res.json({ success: true, results });
  } catch (err) {
    console.error('Unexpected error during bulk scrape:', err);
    res
      .status(500)
      .json({ success: false, error: 'Unexpected server error during bulk scrape.' });
  }
});

app.get('/api/library', (req, res) => {
  try {
    res.json({ success: true, artists: listLibrary() });
  } catch (err) {
    console.error('Error listing library:', err);
    res
      .status(500)
      .json({ success: false, error: 'Could not read the output directory.' });
  }
});

app.get('/api/library/pdf/:artist/:filename', (req, res) => {
  const filePath = resolvePdfPath(req.params.artist, req.params.filename);
  if (!filePath) {
    return res.status(404).json({ success: false, error: 'PDF not found.' });
  }

  res.contentType('application/pdf');
  res.sendFile(filePath);
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
