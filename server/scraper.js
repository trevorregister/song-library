const axios = require('axios');
const cheerio = require('cheerio');
const he = require('he');

const UG_TAB_URL_RE = /^https?:\/\/(www\.)?tabs\.ultimate-guitar\.com\/tab\/[^/]+\/[^/]+-(chords|tabs)-\d+\/?$/i;

class ScrapeError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function isValidUgUrl(url) {
  return typeof url === 'string' && UG_TAB_URL_RE.test(url.trim());
}

async function fetchTabPage(url) {
  const response = await axios.get(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
    },
    timeout: 15000,
  });
  return response.data;
}

function extractJsStoreJson(html) {
  const $ = cheerio.load(html);
  const el = $('div.js-store');
  if (!el.length) {
    throw new ScrapeError(
      "Couldn't parse tab data — page structure may have changed (js-store div not found)."
    );
  }
  const raw = el.attr('data-content');
  if (!raw) {
    throw new ScrapeError(
      "Couldn't parse tab data — page structure may have changed (data-content missing)."
    );
  }
  const decoded = he.decode(raw);
  try {
    return JSON.parse(decoded);
  } catch (e) {
    throw new ScrapeError(
      "Couldn't parse tab data — page structure may have changed (invalid JSON)."
    );
  }
}

function findTabView(json) {
  const tabView = json?.store?.page?.data?.tab_view;
  if (tabView && typeof tabView === 'object') return tabView;
  return null;
}

function extractTabData(json) {
  const tabView = findTabView(json);
  if (!tabView) {
    throw new ScrapeError(
      "Couldn't parse tab data — page structure may have changed (tab_view not found)."
    );
  }

  const content = tabView.wiki_tab?.content;
  const tab = json?.store?.page?.data?.tab || {};

  if (typeof content !== 'string' || !content.length) {
    throw new ScrapeError(
      "Couldn't parse tab data — page structure may have changed (content field not found)."
    );
  }

  const title = tab.song_name || tabView.song_name || 'Untitled';
  const artist = tab.artist_name || tabView.artist_name || 'Unknown Artist';

  return { content, title, artist };
}

async function scrapeTab(url) {
  if (!isValidUgUrl(url)) {
    throw new ScrapeError('Not a valid Ultimate Guitar chord-tab URL.');
  }

  const html = await fetchTabPage(url);
  const json = extractJsStoreJson(html);

  if (process.env.NODE_ENV !== 'production') {
    console.log(
      'js-store JSON top-level keys:',
      Object.keys(json || {})
    );
    console.log(
      'store.page.data keys:',
      Object.keys(json?.store?.page?.data || {})
    );
  }

  const data = extractTabData(json);

  if (process.env.NODE_ENV !== 'production') {
    console.log('Extracted title/artist:', data.title, '-', data.artist);
    console.log('Content preview:', data.content.slice(0, 500));
  }

  return data;
}

module.exports = {
  ScrapeError,
  isValidUgUrl,
  fetchTabPage,
  extractJsStoreJson,
  extractTabData,
  scrapeTab,
};
