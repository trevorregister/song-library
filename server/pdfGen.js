const fs = require('fs');
const path = require('path');

// Puppeteer ships as an ESM package. Electron's bundled Node doesn't support
// synchronous `require()` of ESM (unlike newer standalone Node), so it's
// loaded lazily via dynamic import — this works under both runtimes.
let puppeteerPromise;
function loadPuppeteer() {
  if (!puppeteerPromise) puppeteerPromise = import('puppeteer');
  return puppeteerPromise;
}

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

// UG's raw content is already line-wrapped to a screen-friendly width, so
// the fixed 8pt/2-column layout below normally fits it fine. Other sources
// (e.g. Songsterr, whose chord/lyric positions come from the original
// syllable-precise text rather than any particular column width) can
// produce noticeably wider lines. Rather than clip that content (losing
// text — the previous behavior before `overflow: hidden` was added below
// was silent horizontal bleed into the next column, not wrapping), widen
// to a single column and, only if that's still not enough, shrink the
// font — both computed from the single longest line in the chart so nothing
// gets cut off.
const PAGE_CONTENT_WIDTH_PT = 586; // Letter width minus the 10px side margins
const COLUMN_GAP_PT = 18; // matches `column-gap: 24px` below
const CHAR_WIDTH_EM = 0.62; // approximate monospace advance width
const DEFAULT_FONT_PT = 8;
const MIN_FONT_PT = 5;

function longestLineLength(blocks) {
  let max = 0;
  for (const block of blocks) {
    const lines =
      block.type === 'pair'
        ? [block.chordLine, block.lyricLine]
        : [block.text];
    for (const line of lines) {
      if (line && line.length > max) max = line.length;
    }
  }
  return max;
}

function computeChartLayout(blocks) {
  const maxLineLength = longestLineLength(blocks);
  const twoColumnWidth = (PAGE_CONTENT_WIDTH_PT - COLUMN_GAP_PT) / 2;
  const widthNeeded = maxLineLength * CHAR_WIDTH_EM * DEFAULT_FONT_PT;

  const columnCount = widthNeeded <= twoColumnWidth ? 2 : 1;
  const columnWidth = columnCount === 2 ? twoColumnWidth : PAGE_CONTENT_WIDTH_PT;
  const fontSizePt =
    widthNeeded <= columnWidth
      ? DEFAULT_FONT_PT
      : Math.max(MIN_FONT_PT, columnWidth / (maxLineLength * CHAR_WIDTH_EM));

  return { columnCount, fontSizePt };
}

function buildHtmlDocument({ title, artist, blocks }) {
  const body = renderBlocksHtml(blocks);
  const { columnCount, fontSizePt } = computeChartLayout(blocks);
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
    column-count: ${columnCount};
    column-gap: 24px;
    column-rule: 1px solid #d1d5db;
  }
  .block {
    break-inside: avoid;
    -webkit-column-break-inside: avoid;
  }
  .chord-line, .lyric-line {
    white-space: pre;
    overflow: hidden;
    font-size: ${fontSizePt}pt;
    line-height: 1.4;
  }
  .chord-line {
    color: #b91c1c;
    font-weight: 600;
  }
  .section-header {
    white-space: pre;
    overflow: hidden;
    font-weight: 700;
    margin-top: 16px;
    font-size: ${fontSizePt}pt;
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

// Set once at server startup (packaged Electron builds pass the bundled
// Chromium's path here); left undefined otherwise so Puppeteer resolves its
// own cached Chromium, as it does when running via `npm run dev`.
let chromiumExecutablePath;

function setChromiumExecutablePath(execPath) {
  chromiumExecutablePath = execPath;
}

async function launchBrowser() {
  const { default: puppeteer } = await loadPuppeteer();
  return puppeteer.launch({
    headless: true,
    executablePath: chromiumExecutablePath,
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
  setChromiumExecutablePath,
};
