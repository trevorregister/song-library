const express = require('express');
const path = require('path');
const cors = require('cors');
const { PORT } = require('./config');
const { scrapeBulk } = require('./bulk');
const { listLibrary, resolvePdfPath } = require('./library');
const { resolveOutputDirPath, ensureWritableDir } = require('./outputDir');
const { setChromiumExecutablePath } = require('./pdfGen');

// Builds the Express app. Passing `clientDistPath` (the built Vue app's
// `dist/` dir) additionally serves it as static files with an SPA fallback,
// so the same server can host both the API and the UI on one origin — used
// when running inside Electron. Omitted for the plain `npm run dev` /
// `node index.js` workflow, where Vite's dev server serves the UI instead.
function createApp({ clientDistPath } = {}) {
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

  if (clientDistPath) {
    app.use(express.static(clientDistPath));
    app.get('/{*splat}', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(clientDistPath, 'index.html'));
    });
  }

  return app;
}

// Starts listening and resolves with the underlying http.Server once bound —
// used directly by `node index.js`, and by Electron's main process (which
// also passes `clientDistPath` and `puppeteerExecutablePath`).
function startServer(opts = {}) {
  if (opts.puppeteerExecutablePath) {
    setChromiumExecutablePath(opts.puppeteerExecutablePath);
  }

  const app = createApp(opts);
  return new Promise((resolve) => {
    const server = app.listen(opts.port ?? PORT, () => {
      console.log(`Server listening on http://localhost:${server.address().port}`);
      resolve(server);
    });
  });
}

module.exports = { createApp, startServer };

if (require.main === module) {
  startServer();
}
