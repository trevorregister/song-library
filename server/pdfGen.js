const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { OUTPUT_DIR } = require('./config');

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

function renderBlocksHtml(blocks) {
  const parts = [];
  for (const block of blocks) {
    if (block.type === 'header') {
      parts.push(
        `<div class="section-header">${escapeHtml(block.text)}</div>`
      );
    } else if (block.type === 'pair') {
      parts.push(
        `<div class="chord-line">${escapeHtml(block.chordLine)}</div>` +
          `<div class="lyric-line">${escapeHtml(block.lyricLine)}</div>`
      );
    } else {
      parts.push(`<div class="lyric-line">${escapeHtml(block.text)}</div>`);
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
    padding: 32px 40px;
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
  .chord-line, .lyric-line {
    white-space: pre;
    font-size: 13px;
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
    font-size: 13px;
  }
</style>
</head>
<body>
  <h1 class="title">${escapeHtml(title)}</h1>
  <div class="artist">${escapeHtml(artist)}</div>
  ${body}
</body>
</html>`;
}

async function generatePdfBuffer(html) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const buffer = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' },
    });
    return buffer;
  } finally {
    await browser.close();
  }
}

async function createTabPdf({ title, artist, blocks }) {
  const html = buildHtmlDocument({ title, artist, blocks });
  const buffer = await generatePdfBuffer(html);

  const artistDir = path.join(OUTPUT_DIR, sanitizeFilename(artist));
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
};
