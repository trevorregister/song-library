require('dotenv').config();

const OUTPUT_DIR = process.env.OUTPUT_DIR;
if (!OUTPUT_DIR) {
  throw new Error('OUTPUT_DIR is not set in .env');
}

module.exports = {
  OUTPUT_DIR,
  PORT: process.env.PORT || 3001,
  // Throttling for bulk scrapes: delay between requests to Ultimate Guitar,
  // plus retry/backoff config for individual fetches hitting 429/503.
  SCRAPE_DELAY_MS: Number(process.env.SCRAPE_DELAY_MS) || 3000,
  SCRAPE_JITTER_MS: Number(process.env.SCRAPE_JITTER_MS) || 1500,
  SCRAPE_MAX_RETRIES: Number(process.env.SCRAPE_MAX_RETRIES) || 2,
  // Bulk requests aren't capped — any number of URLs is accepted and
  // processed internally in batches of this size (a fresh browser per
  // batch), rather than rejecting large pastes outright.
  BULK_BATCH_SIZE: Number(process.env.BULK_BATCH_SIZE) || 25,
};
