// electron-builder's `files` glob matching doesn't reliably pull in content
// from outside `directories.app` via `../` patterns (only its separate
// node_modules dependency walker crosses that boundary). So before packaging,
// copy the real server/ and the built client/dist/ into electron/vendor/ —
// plain siblings of electron/main.js and electron/node_modules inside the
// same app directory — which `files` can then include normally.
const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..', '..');
const vendorDir = path.join(__dirname, '..', 'vendor');

fs.rmSync(vendorDir, { recursive: true, force: true });
fs.mkdirSync(vendorDir, { recursive: true });

fs.cpSync(path.join(repoRoot, 'server'), path.join(vendorDir, 'server'), {
  recursive: true,
  filter: (src) => path.basename(src) !== 'data',
});

fs.cpSync(path.join(repoRoot, 'client', 'dist'), path.join(vendorDir, 'client-dist'), {
  recursive: true,
});

console.log(`Staged server/ and client/dist/ into ${vendorDir}`);
