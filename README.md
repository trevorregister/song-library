# Song Library

A local app that scrapes chord charts from Ultimate Guitar and saves them as
PDFs, with chords aligned above the lyrics. Paste one or more Ultimate
Guitar chord-tab URLs and it generates a printable PDF for each one,
organized into folders by artist. Includes a browsable library view for the
PDFs you've generated, duplicate detection so the same tab isn't scraped
twice, and throttled requests to avoid hammering Ultimate Guitar during
large batches.

The app runs entirely on your own machine. Nothing is hosted or uploaded;
generated PDFs are saved to a folder you choose on your local filesystem.

## Requirements

- Node.js 20 or later
- npm

## Setup

Clone the repository and install dependencies from the root of the project.
This is an npm workspaces monorepo, so a single `npm install` at the root
installs both the server and client:

```
npm install
```

## Running locally

Start both the server and the client together:

```
npm run dev
```

This runs the Express server on `http://localhost:3001` and the Vite dev
server on `http://localhost:5173`. Open `http://localhost:5173` in your
browser.

To run them separately instead:

```
npm run dev:server
npm run dev:client
```

## First-time setup in the app

The first time you open the app, it will ask you to choose an output
directory. This is the folder on your machine where generated PDFs will be
saved, organized as `<output directory>/<Artist>/<Song>.pdf`. This choice is
stored in your browser's local storage, not in a config file, and can be
changed later from the folder icon in the app's navigation bar.

## Usage

1. On the Home page, paste one or more Ultimate Guitar chord-tab URLs into
   the text box, one per line.
2. Click Generate. Each URL is scraped, parsed, and rendered into a PDF.
3. Go to the Library page to browse and open the PDFs you've generated.

## Configuration

The server reads optional settings from `server/.env`:

- `PORT`: port the Express server listens on (default 3001)
- `SCRAPE_DELAY_MS`: base delay in milliseconds between scrape requests
- `SCRAPE_JITTER_MS`: additional random delay added to the base delay
- `SCRAPE_MAX_RETRIES`: number of retries on a failed request before giving up
- `BULK_BATCH_SIZE`: number of URLs processed per browser instance in a
  bulk request

None of these are required. If `server/.env` is missing or incomplete, the
server falls back to built-in defaults.

## Project structure

- `server/`: Express backend. Scrapes Ultimate Guitar, parses chord data,
  and generates PDFs with Puppeteer.
- `client/`: Vue 3 frontend built with Vite, Tailwind CSS, and shadcn-vue.

See `CLAUDE.md` for a more detailed breakdown of the architecture.

## License

MIT. See `LICENSE` for the full text.
