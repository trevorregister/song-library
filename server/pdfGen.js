const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeFilename(name) {
  return name
    .replace(/[/\\?%*:|"<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeForComparison(name) {
  return name
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Reuses an existing artist folder whose name matches case/punctuation-
// insensitively (e.g. "noah_reid" should land in an existing "Noah Reid"
// folder rather than creating a sibling), otherwise picks a fresh sanitized
// name for a new folder.
function resolveArtistDirName(artist, outputDir) {
  const sanitized = sanitizeFilename(artist);
  const target = normalizeForComparison(sanitized);

  let existingDirs = [];
  try {
    existingDirs = fs
      .readdirSync(outputDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  const match = existingDirs.find(
    (dirName) => normalizeForComparison(dirName) === target
  );

  return match || sanitized;
}

function renderBlocksHtml(blocks) {
  const parts = [];
  for (const block of blocks) {
    if (block.type === 'header') {
      parts.push(
        `<div class="block section-header">${escapeHtml(block.text)}</div>`
      );
    } else if (block.type === 'pair') {
      parts.push(
        `<div class="block">` +
          `<div class="chord-line">${escapeHtml(block.chordLine)}</div>` +
          `<div class="lyric-line">${escapeHtml(block.lyricLine)}</div>` +
          `</div>`
      );
    } else {
      parts.push(
        `<div class="block lyric-line">${escapeHtml(block.text)}</div>`
      );
    }
  }
  return parts.join('\n');
}

function buildHtmlDocument({ title, artist, blocks }) {
  const body = renderBlocksHtml(blocks);
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body {
    font-family: ui-monospace, Menlo, Consolas, monospace;
    padding: 16px 20px;
    color: #111;
  }
  .title {
    font-family: -apple-system, Helvetica, Arial, sans-serif;
    font-size: 24px;
    font-weight: 700;
    margin: 0;
  }
  .artist {
    font-family: -apple-system, Helvetica, Arial, sans-serif;
    font-size: 14px;
    color: #555;
    margin: 4px 0 20px 0;
  }
  .chart {
    column-count: 2;
    column-gap: 24px;
    column-rule: 1px solid #d1d5db;
  }
  .block {
    break-inside: avoid;
    -webkit-column-break-inside: avoid;
  }
  .chord-line, .lyric-line {
    white-space: pre;
    font-size: 8pt;
    line-height: 1.4;
  }
  .chord-line {
    color: #b91c1c;
    font-weight: 600;
  }
  .section-header {
    white-space: pre;
    font-weight: 700;
    margin-top: 16px;
    font-size: 8pt;
  }
</style>
</head>
<body>
  <h1 class="title">${escapeHtml(title)}</h1>
  <div class="artist">${escapeHtml(artist)}</div>
  <div class="chart">
    ${body}
  </div>
</body>
</html>`;
}

async function launchBrowser() {
  return puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
}

// Accepts an optional shared browser instance so a bulk job can reuse one
// Chromium process across many PDFs instead of launching one per song.
async function generatePdfBuffer(html, sharedBrowser) {
  const browser = sharedBrowser || (await launchBrowser());
  try {
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'networkidle0' });
      return await page.pdf({
        format: 'Letter',
        printBackground: true,
        margin: { top: '10px', bottom: '10px', left: '10px', right: '10px' },
      });
    } finally {
      await page.close();
    }
  } finally {
    if (!sharedBrowser) await browser.close();
  }
}

async function createTabPdf({ title, artist, blocks, outputDir }, sharedBrowser) {
  const html = buildHtmlDocument({ title, artist, blocks });
  const buffer = await generatePdfBuffer(html, sharedBrowser);

  const artistDir = path.join(outputDir, resolveArtistDirName(artist, outputDir));
  const filename = `${sanitizeFilename(title)}.pdf`;

  fs.mkdirSync(artistDir, { recursive: true });
  const filePath = path.join(artistDir, filename);
  fs.writeFileSync(filePath, buffer);

  return { filename, path: filePath };
}

module.exports = {
  buildHtmlDocument,
  createTabPdf,
  sanitizeFilename,
  resolveArtistDirName,
  launchBrowser,
};
