const fs = require('fs');
const path = require('path');
const { OUTPUT_DIR } = require('./config');

// Scans OUTPUT_DIR/<Artist>/<Title>.pdf into a nested artist -> songs tree.
function listLibrary() {
  let artistDirs = [];
  try {
    artistDirs = fs
      .readdirSync(OUTPUT_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory());
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }

  return artistDirs
    .map((dirEntry) => {
      const artist = dirEntry.name;
      const artistPath = path.join(OUTPUT_DIR, artist);
      const songs = fs
        .readdirSync(artistPath, { withFileTypes: true })
        .filter(
          (entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')
        )
        .map((entry) => ({
          title: entry.name.replace(/\.pdf$/i, ''),
          filename: entry.name,
        }))
        .sort((a, b) => a.title.localeCompare(b.title));
      return { artist, songs };
    })
    .filter((a) => a.songs.length > 0)
    .sort((a, b) => a.artist.localeCompare(b.artist));
}

// Resolves an artist/filename pair (as supplied by the client) to an
// absolute path on disk, refusing to serve anything outside OUTPUT_DIR.
// path.basename strips any path separators from each segment, so a
// traversal attempt like "../../etc/passwd" collapses to just "passwd"
// before it's ever joined — the startsWith check below is defense in depth.
function resolvePdfPath(artist, filename) {
  const safeArtist = path.basename(artist || '');
  const safeFilename = path.basename(filename || '');
  const resolved = path.resolve(OUTPUT_DIR, safeArtist, safeFilename);
  const outputRoot = path.resolve(OUTPUT_DIR) + path.sep;

  if (!resolved.startsWith(outputRoot)) return null;
  if (!safeFilename.toLowerCase().endsWith('.pdf')) return null;

  try {
    if (!fs.statSync(resolved).isFile()) return null;
  } catch {
    return null;
  }

  return resolved;
}

module.exports = { listLibrary, resolvePdfPath };
