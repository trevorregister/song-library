const fs = require('fs');
const path = require('path');

// Scans outputDir/<Artist>/<Title>.pdf into a nested artist -> songs tree.
function listLibrary(outputDir) {
  let artistDirs = [];
  try {
    artistDirs = fs
      .readdirSync(outputDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory());
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }

  return artistDirs
    .map((dirEntry) => {
      const artist = dirEntry.name;
      const artistPath = path.join(outputDir, artist);
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
// absolute path on disk, refusing to serve anything outside outputDir.
// path.basename strips any path separators from each segment, so a
// traversal attempt like "../../etc/passwd" collapses to just "passwd"
// before it's ever joined — the startsWith check below is defense in depth.
function resolvePdfPath(outputDir, artist, filename) {
  const safeArtist = path.basename(artist || '');
  const safeFilename = path.basename(filename || '');
  const resolved = path.resolve(outputDir, safeArtist, safeFilename);
  const outputRoot = path.resolve(outputDir) + path.sep;

  if (!resolved.startsWith(outputRoot)) return null;
  if (!safeFilename.toLowerCase().endsWith('.pdf')) return null;

  try {
    if (!fs.statSync(resolved).isFile()) return null;
  } catch {
    return null;
  }

  return resolved;
}

// Deletes a single PDF, then removes its artist folder if that was the last
// song in it (so an emptied artist quietly disappears from the library
// instead of lingering as a hidden empty directory).
function deletePdf(outputDir, artist, filename) {
  const resolved = resolvePdfPath(outputDir, artist, filename);
  if (!resolved) return false;

  fs.unlinkSync(resolved);

  const artistDir = path.dirname(resolved);
  const remaining = fs.readdirSync(artistDir);
  if (remaining.length === 0) fs.rmdirSync(artistDir);

  return true;
}

// Deletes an entire artist folder (and everything in it). Same traversal
// safety as resolvePdfPath: path.basename strips any path separators before
// the startsWith check confirms the result is still inside outputDir.
function deleteArtist(outputDir, artist) {
  const safeArtist = path.basename(artist || '');
  const resolved = path.resolve(outputDir, safeArtist);
  const outputRoot = path.resolve(outputDir) + path.sep;

  if (!safeArtist || !resolved.startsWith(outputRoot)) return false;

  try {
    if (!fs.statSync(resolved).isDirectory()) return false;
  } catch {
    return false;
  }

  fs.rmSync(resolved, { recursive: true, force: true });
  return true;
}

module.exports = { listLibrary, resolvePdfPath, deletePdf, deleteArtist };
