// Stages the currently-installed Puppeteer's cached Chromium build into
// electron/resources/chromium/ so electron-builder can ship it as an
// extraResource. Runs at build time (not install time) so we never hardcode
// a Chrome-for-Testing version string that would drift whenever the
// `puppeteer` dependency is bumped.
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

// Puppeteer's cache layout is `<cacheDir>/chrome/<platform-version>/...`.
// Walk up from the resolved executable until we find the directory whose
// parent is named `chrome` — that's the platform-version dir to stage.
function findVersionDir(startDir) {
  let dir = startDir;
  while (true) {
    const parent = path.dirname(dir);
    if (path.basename(parent) === 'chrome') return dir;
    if (parent === dir) return null;
    dir = parent;
  }
}

async function main() {
  const execPath = await puppeteer.executablePath();
  const versionDir = findVersionDir(path.dirname(execPath));

  if (!versionDir) {
    throw new Error(
      `Could not locate Puppeteer's cached Chromium directory from executable path: ${execPath}`
    );
  }

  const destDir = path.join(__dirname, '..', 'resources', 'chromium');
  fs.rmSync(destDir, { recursive: true, force: true });
  fs.mkdirSync(destDir, { recursive: true });
  fs.cpSync(versionDir, path.join(destDir, path.basename(versionDir)), {
    recursive: true,
  });

  console.log(`Staged Chromium from ${versionDir} into ${destDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
