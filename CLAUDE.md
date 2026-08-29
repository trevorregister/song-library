# Song Library

Local Node/Express + Vue app that scrapes chord charts from Ultimate Guitar
and saves them as PDFs with chords aligned above lyrics. npm workspaces
monorepo: `server/` (Express + Puppeteer + Cheerio) and `client/` (Vue 3 +
Vite + Tailwind + shadcn-vue).

## Critical rules

- **Never delete or wipe the user's output directory.** Where PDFs get
  saved is chosen by the user in the client UI (stored in the browser's
  `localStorage`, sent to the server per-request — see Architecture below),
  not a fixed path in this repo. The local `output/` directory some testing
  has used is git-ignored, so nothing in it is recoverable from git history
  if deleted. Do not run `rm -rf` on it, clear it out "to get a clean
  test," or otherwise touch its contents — not even temporarily. If you
  need an empty directory to test PDF generation against, use a scratch
  directory (e.g. under the session scratchpad) and pass that as the
  `outputDir`, never a directory that might hold real generated PDFs.
- **Do not run Puppeteer, Playwright, or any other browser automation to
  test the UI** (including using the server's own Puppeteer dependency to
  drive a headless browser for verification). The user does all UI testing
  themselves. Backend logic (parser, scraper, PDF generation, routes) can
  still be tested directly via `node -e` scripts or curl against the API.

## Running locally

- `npm run dev` from the repo root runs both server (3001) and client
  (5173) together via `concurrently`. `npm run dev:server` /
  `npm run dev:client` run them individually.
- `server/.env` sets `PORT` and scrape-throttling config
  (`SCRAPE_DELAY_MS`, `SCRAPE_JITTER_MS`, `SCRAPE_MAX_RETRIES`,
  `BULK_BATCH_SIZE`). It does **not** set an output directory — that's
  chosen client-side (see below).
- Vite dev server proxies `/api/*` to `localhost:3001` (see
  `client/vite.config.js`), so the client always calls relative `/api/...`
  paths, never an absolute backend URL.

## Architecture

### Output directory is client-owned, not server config

The server has no fixed notion of where PDFs live. The client stores a
chosen absolute path in `localStorage` (via `composables/useOutputDir.js`)
and sends it with every request that needs it:
- GET requests (`/api/library`, `/api/library/pdf/:artist/:filename`) take
  it as an `?outputDir=` query param — deliberately not a header, since the
  PDF route is opened via a plain `<a target="_blank">` link (native
  browser navigation can't attach custom headers).
- The bulk-scrape POST takes it as an `outputDir` field in the JSON body.

`server/outputDir.js` (`resolveOutputDirPath`) resolves/validates that
value on every request (expanding a leading `~`, `path.resolve`-ing it) —
there is no server-side default or fallback. `POST /api/output-dir/check`
lets the client verify a directory is creatable/writable *before* saving it
to `localStorage`; the client shows a setup prompt
(`components/OutputDirSetup.vue`) whenever no directory is stored yet. The
same prompt is reachable anytime via the folder-icon button in `App.vue`'s
nav (toggles `showDirSetup`), so switching directories mid-session doesn't
require clearing `localStorage` manually — the `RouterView` key already
includes `outputDir`, so the active view refetches immediately on change.

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
  filesystem-illegal characters; `resolveArtistDirName(artist, outputDir)`
  normalizes artist names (lowercase, `_`/`-` → space, collapsed whitespace)
  against existing folders in `outputDir` so near-duplicate spellings
  (`Noah Reid` / `noah_reid`) land in the same folder instead of creating
  siblings. `generatePdfBuffer`/`createTabPdf` accept an optional shared
  Puppeteer `browser` instance so bulk runs reuse one Chromium process per
  batch instead of launching one per song. Every function that touches disk
  takes `outputDir` explicitly — nothing here reads a global.
- **`urlStore.js`** — persistent dedupe index at
  `server/data/scraped-urls.json` (git-ignored — per-machine usage history,
  not source), keyed by UG's numeric tab ID extracted from the URL (falls
  back to a normalized full URL string if no ID is found), so a trailing
  slash, different casing, or slug rewording still dedupes to the same
  entry. `findExisting(url)` also verifies the previously-recorded PDF
  still exists on disk — if the user deletes a PDF, its URL stops being
  treated as a duplicate rather than silently blocking a re-scrape forever.
  This index is global across whatever `outputDir` was in effect at scrape
  time — dedup means "you've scraped this tab before, here's where it
  went," independent of the currently-selected output directory.
- **`bulk.js`** — the only scrape entry point (single-URL scraping was
  removed; paste one URL in the bulk form to scrape just one). Accepts any
  number of URLs and internally chunks them into batches of
  `BULK_BATCH_SIZE` (fresh browser per batch, to bound memory growth on
  very large pastes). Within a batch, URLs are processed **strictly
  sequentially** (never in parallel); a randomized delay
  (`SCRAPE_DELAY_MS` + jitter) is inserted between requests, but *only*
  after a request that actually hit UG — a URL skipped via the dedupe index
  costs no wait. Per-URL failures are isolated — one bad URL doesn't abort
  the rest of the batch.
- **`library.js`** — scans `outputDir/<Artist>/<Song>.pdf` into a nested
  tree for the browse UI, and resolves a client-supplied artist/filename
  pair to a safe path on disk (`path.basename` strips traversal attempts,
  plus a `startsWith(outputRoot)` check as defense in depth) for streaming
  individual PDFs.
- **`index.js`** — wires up routes: `POST /api/output-dir/check`
  (validate before persisting client-side), `POST /api/scrape/bulk`,
  `GET /api/library`, `GET /api/library/pdf/:artist/:filename`.

### `client/` (Vue 3 + Vite + Tailwind + shadcn-vue)

- Routed with `vue-router` (`createWebHistory`) — `src/router.js` defines
  `/` (Home) and `/library` (a single expandable file-tree view, not a
  separate per-artist page — see below). An old `/library/:artist` link
  shape still redirects to `/library?artist=...` for backward compatibility.
  `App.vue` is a thin shell (nav + `<RouterView>`); each view fetches its
  own data on mount, so navigating between them always shows fresh state
  without extra event plumbing. The `RouterView` key includes both the
  route and the current `outputDir`, so changing directories immediately
  re-fetches whatever view is showing.
- `views/HomeView.vue` hosts only `components/BulkScrapeForm.vue`
  (newline-separated URLs, one or many) — POSTs to `/api/scrape/bulk` and
  surfaces a per-row "View in library" deep link plus a duplicate/success
  count derived from the response.
- `views/LibraryView.vue` renders the whole library as one expandable file
  tree (lucide `Folder`/`FolderOpen`/`FileText`/chevron icons) rather than
  a grid-of-cards-to-separate-page — clicking an artist folder toggles it
  open inline; clicking a song links directly at
  `/api/library/pdf/:artist/:filename?outputDir=...` with
  `target="_blank"`, intentionally opening the browser's native full PDF
  viewer, **not** an embedded/scaled preview. A `?artist=` query param
  auto-expands and scrolls to that artist on load (used by the deep links
  above).
- `composables/useOutputDir.js` and `composables/useDarkMode.js` are
  small module-level-state composables (not Pinia — the app doesn't need
  more than this) backed by `localStorage`. Dark mode defaults to dark
  unless the user has explicitly chosen light (toggles the `.dark` class
  that shadcn-vue's Tailwind v4 setup already keys all its CSS variables
  off of — see `style.css`).
- shadcn-vue components live in `src/components/ui/`. Note: the `Tabs`
  component fails to install in this monorepo (`reka-ui` type resolution
  breaks when hoisted to the workspace root) — avoided in favor of plain
  `Card`-based layouts.
