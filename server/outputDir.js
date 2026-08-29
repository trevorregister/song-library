const fs = require('fs');
const os = require('os');
const path = require('path');

// The output directory is chosen by the client (stored in its own
// localStorage) rather than fixed on the server, so every request that
// needs it must supply one explicitly — there is no server-side default.
function resolveOutputDirPath(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  let p = raw.trim();
  if (p === '~' || p.startsWith('~/')) {
    p = path.join(os.homedir(), p.slice(1));
  }
  return path.resolve(p);
}

function ensureWritableDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  fs.accessSync(dir, fs.constants.W_OK);
}

module.exports = { resolveOutputDirPath, ensureWritableDir };
