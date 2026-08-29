# Song Library

Local Node/Express + Vue app that scrapes chord charts from Ultimate Guitar
and saves them as PDFs with chords aligned above lyrics. npm workspaces
monorepo: `server/` (Express + Puppeteer + Cheerio) and `client/` (Vue 3 +
Vite + Tailwind + shadcn-vue).

## Critical rules

- **Never delete or wipe `output/`.** It holds the user's real generated
  PDFs, organized as `output/<Artist>/<Song>.pdf`. It's git-ignored, so
  nothing in it is recoverable from git history if it's deleted. Do not run
  `rm -rf output`, clear it out "to get a clean test", or otherwise touch
  its contents — not even temporarily. If you need a clean directory to
  test PDF generation against, point `OUTPUT_DIR` at a scratch directory
  instead (e.g. via an env override for that one command), and never at the
  real `output/` path.
- **Do not run Puppeteer, Playwright, or any other browser automation to
  test the UI** (including using the server's own Puppeteer dependency to
  drive a headless browser for verification). The user does all UI testing
  themselves. Backend logic (parser, scraper, PDF generation) can still be
  tested directly via `node -e` scripts or curl against the API.

## Running locally

- `npm run dev` from the repo root runs both server (3001) and client
  (5173) together via `concurrently`. `npm run dev:server` /
  `npm run dev:client` run them individually.
- `server/.env` sets `OUTPUT_DIR` (where PDFs get saved) and other config
  (`SCRAPE_DELAY_MS`, `SCRAPE_JITTER_MS`, `SCRAPE_MAX_RETRIES`,
  `BULK_BATCH_SIZE`).
- Vite dev server proxies `/api/*` to `localhost:3001` (see
  `client/vite.config.js`), so the client always calls relative `/api/...`
  paths, never an absolute backend URL.

## Architecture

### `server/` (Express)

- **`scraper.js`** — fetches a UG tab page with axios, finds the
  `<div class="js-store" data-content="...">` element (Cheerio), HTML-entity
  decodes the attribute (`he`), and `JSON.parse`s it. The tab's raw chord
  content lives at `store.page.data.tab_view.wiki_tab.content`; title/artist
  come from `store.page.data.tab` (falling back to fields on `tab_view`).
  `fetchTabPage` retries on 429/503/network errors with exponential
  backoff (honoring `Retry-After`) before giving up — important since bulk
  runs hit UG repeatedly.
- **`parser.js`** — turns the raw UG content string into an ordered list of
  `{ type: 'header' | 'pair' | 'lyric', ... }` blocks by scanning `[ch]X[/ch]`
  tags char-by-char and recording chord columns relative to the plain lyric
  text. Two non-obvious fixups discovered against real UG data (not just the
  spec's idealized format):
  - UG content uses `\r\n` line endings — stripped before splitting, or
    stray `\r` chars pollute every line's length/columns.
  - UG frequently puts a line of chords on its own raw line (wrapped in
    `[tab]...[/tab]`) followed by the lyric on the *next* raw line, rather
    than interleaving `[ch]` tags into the lyric line itself. A merge pass
    (`mergeChordOnlyWithFollowingLyric`) combines a chord-only line with its
    following lyric line into one `pair` block so rendering doesn't show a
    blank line between chords and lyrics.
- **`pdfGen.js`** — renders parsed blocks into a standalone HTML document
  (monospace, two-column CSS layout with a `column-rule` divider, 8pt chord/
  lyric text, halved margins — all tuned to fit a typical song on one page)
  and rasterizes it with Puppeteer's `page.pdf()`. `sanitizeFilename` strips
  filesystem-illegal characters; `resolveArtistDirName` normalizes artist
  names (lowercase, `_`/`-` → space, collapsed whitespace) against existing
  folders in `OUTPUT_DIR` so near-duplicate spellings (`Noah Reid` /
  `noah_reid`) land in the same folder instead of creating siblings.
  `generatePdfBuffer`/`createTabPdf` accept an optional shared Puppeteer
  `browser` instance so bulk runs reuse one Chromium process per batch
  instead of launching one per song.
- **`bulk.js`** — processes any number of URLs by internally chunking them
  into batches of `BULK_BATCH_SIZE` (fresh browser per batch, to bound
  memory growth on very large pastes). Within a batch, URLs are processed
  **strictly sequentially** (never in parallel) with a randomized delay
  (`SCRAPE_DELAY_MS` + jitter) between requests, so a large batch doesn't
  hammer UG with a fixed, easily-flagged cadence. Per-URL failures are
  isolated — one bad URL doesn't abort the rest of the batch.
- **`library.js`** — scans `OUTPUT_DIR/<Artist>/<Song>.pdf` into a nested
  tree for the browse UI, and resolves a client-supplied artist/filename
  pair to a safe path on disk (`path.basename` strips traversal attempts,
  plus a `startsWith(outputRoot)` check as defense in depth) for streaming
  individual PDFs.
- **`index.js`** — wires up routes: `POST /api/scrape` (single),
  `POST /api/scrape/bulk` (batched), `GET /api/library` (tree),
  `GET /api/library/pdf/:artist/:filename` (streams one PDF inline).

### `client/` (Vue 3 + Vite + Tailwind + shadcn-vue)

- Routed with `vue-router` (`createWebHistory`) — `src/router.js` defines
  `/` (Home), `/library` (artist list), `/library/:artist` (that artist's
  songs). `App.vue` is a thin shell (nav + `<RouterView>`); each view
  fetches its own data on mount, so navigating between them always shows
  fresh state without extra event plumbing.
- `views/HomeView.vue` hosts `components/ScrapeForm.vue` (single URL) and
  `components/BulkScrapeForm.vue` (newline-separated URLs) — both POST to
  the corresponding `/api/scrape*` route and surface a "View in library"
  deep link derived from the returned file path.
- `views/ArtistView.vue` lists a given artist's songs as plain links
  pointing directly at `/api/library/pdf/:artist/:filename` with
  `target="_blank"` — clicking opens the browser's native full PDF viewer,
  intentionally **not** an embedded/scaled preview.
- shadcn-vue components live in `src/components/ui/`. Note: the `Tabs`
  component fails to install in this monorepo (`reka-ui` type resolution
  breaks when hoisted to the workspace root) — avoided in favor of plain
  `Card`-based layouts.
