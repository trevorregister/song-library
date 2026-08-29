const axios = require('axios');
const cheerio = require('cheerio');
const { ScrapeError } = require('./scraper');
const { SCRAPE_MAX_RETRIES } = require('./config');

const SONGSTERR_URL_RE = /^https?:\/\/(www\.)?songsterr\.com\/a\/wsa\/[^/]+-chords-s\d+\/?$/i;

function isValidSongsterrUrl(url) {
  return typeof url === 'string' && SONGSTERR_URL_RE.test(url.trim());
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Same retry-with-backoff shape as scraper.js's fetchTabPage — kept as a
// separate copy rather than shared so each source's scraper stays
// self-contained.
async function fetchTabPage(url, attempt = 0) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      timeout: 15000,
    });
    return response.data;
  } catch (err) {
    const status = err.response?.status;
    const isRetryable = status === 429 || status === 503 || !err.response;

    if (isRetryable && attempt < SCRAPE_MAX_RETRIES) {
      const retryAfter = Number(err.response?.headers?.['retry-after']);
      const backoffMs = Number.isFinite(retryAfter)
        ? retryAfter * 1000
        : 1000 * 2 ** attempt + Math.random() * 500;
      await sleep(backoffMs);
      return fetchTabPage(url, attempt + 1);
    }

    throw new ScrapeError(
      `Failed to fetch the tab page${status ? ` (HTTP ${status})` : ''}.`,
      502
    );
  }
}

// Songsterr embeds its full client-side Redux state as plain JSON in
// <script id="state" type="application/json">, unlike UG's HTML-attribute
// encoded js-store div — no entity decoding needed here.
function extractState(html) {
  const $ = cheerio.load(html);
  const el = $('script#state');
  if (!el.length) {
    throw new ScrapeError(
      "Couldn't parse tab data — page structure may have changed (state script not found)."
    );
  }
  try {
    return JSON.parse(el.html());
  } catch (e) {
    throw new ScrapeError(
      "Couldn't parse tab data — page structure may have changed (invalid JSON)."
    );
  }
}

function extractSongsterrData(json) {
  if (json?.route?.page !== 'chords') {
    throw new ScrapeError('Not a Songsterr chords page.');
  }

  const chords = json?.chords?.current;
  const chordproLines = json?.chordpro?.current;

  if (!chords || !Array.isArray(chordproLines) || chordproLines.length === 0) {
    throw new ScrapeError(
      "Couldn't parse tab data — page structure may have changed (chordpro data not found)."
    );
  }

  const title = chords.title || 'Untitled';
  const artist = chords.artist || 'Unknown Artist';

  return { chordproLines, title, artist };
}

async function scrapeSongsterrTab(url) {
  if (!isValidSongsterrUrl(url)) {
    throw new ScrapeError('Not a valid Songsterr chord-tab URL.');
  }

  const html = await fetchTabPage(url);
  const json = extractState(html);
  return extractSongsterrData(json);
}

module.exports = {
  isValidSongsterrUrl,
  fetchTabPage,
  extractState,
  extractSongsterrData,
  scrapeSongsterrTab,
};
