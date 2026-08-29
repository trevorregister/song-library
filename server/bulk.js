const { scrapeTab, ScrapeError } = require('./scraper');
const { parseContent } = require('./parser');
const { createTabPdf, launchBrowser } = require('./pdfGen');
const { SCRAPE_DELAY_MS, SCRAPE_JITTER_MS, BULK_BATCH_SIZE } = require('./config');
const { findExisting, recordScrape } = require('./urlStore');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Randomized delay between requests so a batch doesn't hammer Ultimate
// Guitar with a fixed, easily-flagged cadence.
function throttleDelay() {
  return sleep(SCRAPE_DELAY_MS + Math.random() * SCRAPE_JITTER_MS);
}

function chunk(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

// Processes one batch of URLs sequentially (never in parallel), reusing a
// single Puppeteer browser across the batch, with a throttled delay between
// requests.
async function scrapeOneBatch(urls, outputDir) {
  const results = [];
  const browser = await launchBrowser();

  try {
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      let fetchedFromUg = false;

      try {
        const existing = findExisting(url);
        if (existing) {
          results.push({
            url,
            success: true,
            duplicate: true,
            filename: existing.filename,
            path: existing.path,
          });
        } else {
          fetchedFromUg = true;
          const { content, title, artist } = await scrapeTab(url);
          const blocks = parseContent(content);
          const { filename, path: filePath } = await createTabPdf(
            { title, artist, blocks, outputDir },
            browser
          );
          recordScrape(url, { title, artist, filename, path: filePath });
          results.push({ url, success: true, filename, path: filePath });
        }
      } catch (err) {
        const message =
          err instanceof ScrapeError
            ? err.message
            : 'Unexpected error while processing this URL.';
        results.push({ url, success: false, error: message });
      }

      // Only throttle after a request that actually hit Ultimate Guitar —
      // a skipped duplicate doesn't need to wait.
      if (fetchedFromUg && i < urls.length - 1) {
        await throttleDelay();
      }
    }
  } finally {
    await browser.close();
  }

  return results;
}

// Accepts any number of URLs. Internally splits them into batches of
// BULK_BATCH_SIZE — processed one batch after another, each with its own
// fresh browser instance — so a very large paste doesn't get rejected, and
// a long-running Chromium process doesn't accumulate memory across
// hundreds of PDFs.
async function scrapeBulk(urls, outputDir) {
  const results = [];
  for (const batch of chunk(urls, BULK_BATCH_SIZE)) {
    results.push(...(await scrapeOneBatch(batch, outputDir)));
  }
  return results;
}

module.exports = { scrapeBulk };
