const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const PORT = 3001;

let server;

// When packaged, server/ and client/dist/ are staged (by
// scripts/stage-app.js at build time) into electron/vendor/ — a plain
// sibling of main.js and node_modules inside the same app.asar — since
// electron-builder's `files` globs can't reach outside the app directory.
function resolveServerPath() {
  return app.isPackaged
    ? path.join(__dirname, 'vendor', 'server')
    : path.join(__dirname, '..', 'server');
}

function resolveClientDistPath() {
  return app.isPackaged
    ? path.join(__dirname, 'vendor', 'client-dist')
    : path.join(__dirname, '..', 'client', 'dist');
}

// The bundled Chromium (staged into `resources/chromium` at build time by
// scripts/copy-chromium.js) ships as an extraResource, so it lands next to
// the app bundle rather than inside app.asar. In dev, returning undefined
// lets Puppeteer fall back to its own locally-cached Chromium.
function resolveChromiumExecutablePath() {
  if (!app.isPackaged) return undefined;

  const chromiumDir = path.join(process.resourcesPath, 'chromium');
  const execPath = findExecutableRecursive(chromiumDir);
  if (execPath) {
    try {
      fs.chmodSync(execPath, 0o755);
    } catch {
      // best-effort — packaging may have already preserved the exec bit
    }
  }
  return execPath;
}

// Puppeteer's Chromium build ships at a version/platform-specific nested
// path (and as a .app bundle on macOS), so we search for the actual binary
// rather than hardcoding a path that would drift with every Puppeteer bump.
function findExecutableRecursive(dir) {
  const CANDIDATE_NAMES = new Set([
    'chrome',
    'chrome.exe',
    'Google Chrome for Testing',
    'headless_shell',
  ]);

  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findExecutableRecursive(fullPath);
      if (found) return found;
    } else if (CANDIDATE_NAMES.has(entry.name)) {
      return fullPath;
    }
  }
  return null;
}

async function createWindow() {
  const clientDistPath = resolveClientDistPath();
  const puppeteerExecutablePath = resolveChromiumExecutablePath();

  const { startServer } = require(resolveServerPath());
  server = await startServer({ port: PORT, clientDistPath, puppeteerExecutablePath });

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadURL(`http://localhost:${PORT}/`);
}

ipcMain.handle('select-output-dir', async () => {
  const win = BrowserWindow.getFocusedWindow();
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

// shell.openPath returns an error string on failure (not a rejected
// promise), or '' on success — surface that to the renderer so it can show
// a message instead of silently doing nothing.
ipcMain.handle('open-output-dir', async (event, dir) => {
  const error = await shell.openPath(dir);
  return error || null;
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (server) server.close();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (server) server.close();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
