const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(__dirname, 'data', 'scraped-urls.json');

function loadStore() {
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw err;
  }
}

function saveStore(store) {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

// Extracts UG's numeric tab id from a validated tab URL (e.g. the
// "4036123" in .../song-chords-4036123), so URLs that differ only in slug
// wording or a trailing slash still dedupe to the same entry. Falls back to
// a normalized full URL if no id is found.
function dedupeKey(url) {
  const trimmed = url.trim().replace(/\/+$/, '');
  const match = trimmed.match(/-(\d+)$/);
  return match ? `id:${match[1]}` : `url:${trimmed.toLowerCase()}`;
}

// Returns the previously recorded entry for this URL, but only if the PDF
// it points at still exists on disk — if the user deleted the file, we
// don't want a stale index entry to silently block re-generating it.
function findExisting(url) {
  const entry = loadStore()[dedupeKey(url)];
  if (!entry) return null;

  try {
    if (!fs.statSync(entry.path).isFile()) return null;
  } catch {
    return null;
  }

  return entry;
}

function recordScrape(url, { title, artist, filename, path: filePath }) {
  const store = loadStore();
  store[dedupeKey(url)] = {
    url,
    title,
    artist,
    filename,
    path: filePath,
    scrapedAt: new Date().toISOString(),
  };
  saveStore(store);
}

// Removes every entry pointing at exactly this PDF path — called when a
// song is deleted from the library so the dedupe index doesn't keep a
// stale (if harmless — findExisting already re-checks disk) record around.
function removeByPath(filePath) {
  const store = loadStore();
  let changed = false;
  for (const key of Object.keys(store)) {
    if (store[key].path === filePath) {
      delete store[key];
      changed = true;
    }
  }
  if (changed) saveStore(store);
  return changed;
}

// Removes every entry whose PDF lived under this directory — called when a
// whole artist folder is deleted from the library.
function removeByPathPrefix(dirPath) {
  const store = loadStore();
  const prefix = dirPath.endsWith(path.sep) ? dirPath : dirPath + path.sep;
  let changed = false;
  for (const key of Object.keys(store)) {
    if (store[key].path.startsWith(prefix)) {
      delete store[key];
      changed = true;
    }
  }
  if (changed) saveStore(store);
  return changed;
}

module.exports = { findExisting, recordScrape, removeByPath, removeByPathPrefix };
