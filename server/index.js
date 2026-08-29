const express = require('express');
const cors = require('cors');
const { PORT } = require('./config');
const { scrapeTab, ScrapeError } = require('./scraper');
const { parseContent } = require('./parser');
const { createTabPdf } = require('./pdfGen');

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

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
