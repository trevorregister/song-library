const HEADER_RE = /^\[[^[\]]+\]$/;
const CH_TAG_RE = /\[ch\](.*?)\[\/ch\]/gi;
const WRAPPER_TAG_RE = /\[\/?tab\]/gi;
// A line of literal six/four-string tab notation, e.g. "e|--0--2--3--" or
// "e|--0--2--3--|" (UG often closes each string line with a trailing bar).
// A single string letter, a bar, then only tab characters (dashes, digits,
// and the usual hammer-on/pull-off/bend/slide markers), then an optional
// closing bar.
const TAB_NOTATION_LINE_RE = /^[a-gA-G]#?\|[-0-9xXhHpPbBsSrR/\\~ ]*\|?$/;

function normalizeTabs(line) {
  return line.replace(/\t/g, '    ');
}

function isHeaderLine(trimmedLine) {
  if (!HEADER_RE.test(trimmedLine)) return false;
  const inner = trimmedLine.slice(1, -1).trim().toLowerCase();
  return inner !== 'tab' && inner !== '/tab';
}

function parseLine(rawLine) {
  const line = normalizeTabs(rawLine);
  const trimmed = line.trim();

  if (isHeaderLine(trimmed)) {
    return { type: 'header', text: trimmed };
  }

  const stripped = line.replace(WRAPPER_TAG_RE, '');

  let lyricText = '';
  const chordPositions = [];
  let lastIndex = 0;
  let match;

  CH_TAG_RE.lastIndex = 0;
  while ((match = CH_TAG_RE.exec(stripped)) !== null) {
    lyricText += stripped.slice(lastIndex, match.index);
    chordPositions.push({ chord: match[1], column: lyricText.length });
    lastIndex = CH_TAG_RE.lastIndex;
  }
  lyricText += stripped.slice(lastIndex);

  if (chordPositions.length === 0) {
    return { type: 'lyric', text: lyricText };
  }

  const chordLine = buildChordLine(lyricText.length, chordPositions);
  return { type: 'pair', chordLine, lyricLine: lyricText };
}

function buildChordLine(lyricLength, chordPositions) {
  const placed = [];
  let prevEnd = -Infinity;

  for (const { chord, column } of chordPositions) {
    let start = column;
    if (start < prevEnd + 1) {
      start = prevEnd + 1;
    }
    placed.push({ chord, start, end: start + chord.length });
    prevEnd = start + chord.length;
  }

  const width = Math.max(lyricLength, prevEnd === -Infinity ? 0 : prevEnd);
  const chars = new Array(width).fill(' ');
  for (const { chord, start } of placed) {
    for (let i = 0; i < chord.length; i++) {
      chars[start + i] = chord[i];
    }
  }
  return chars.join('');
}

// UG often stores a chord-only line followed immediately by its lyric on the
// next raw line, rather than interleaving [ch] tags within the lyric line
// itself. Merge that pattern into a single pair block so rendering doesn't
// show a spurious blank line between the chords and their lyric.
function mergeChordOnlyWithFollowingLyric(blocks) {
  const merged = [];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const next = blocks[i + 1];
    const isChordOnly = block.type === 'pair' && block.lyricLine.trim() === '';

    if (isChordOnly && next && next.type === 'lyric') {
      merged.push({
        type: 'pair',
        chordLine: block.chordLine.padEnd(next.text.length, ' '),
        lyricLine: next.text,
      });
      i++;
    } else {
      merged.push(block);
    }
  }
  return merged;
}

function isTabNotationLine(trimmedLine) {
  return TAB_NOTATION_LINE_RE.test(trimmedLine) && /[-0-9]/.test(trimmedLine);
}

// Strips literal ASCII tab-notation blocks (e.g. under an [Instrumental]
// header) — they're not part of the chords-above-lyrics format this app
// renders, and left in verbatim they just show up as unreadable noise.
// Requires 2+ consecutive matching lines so a single coincidental match
// (unlikely, but possible in a lyric line) isn't dropped on its own.
function stripTabNotationBlocks(lines) {
  const result = [];
  let i = 0;
  while (i < lines.length) {
    if (isTabNotationLine(normalizeTabs(lines[i]).trim())) {
      let j = i;
      while (j < lines.length && isTabNotationLine(normalizeTabs(lines[j]).trim())) {
        j++;
      }
      if (j - i >= 2) {
        i = j;
        continue;
      }
    }
    result.push(lines[i]);
    i++;
  }
  return result;
}

// UG tabs sometimes prefix the actual song content with free-form notes
// (strumming-pattern instructions, a symbol legend, etc.) before the first
// section header. That's not part of the song itself, so drop it — but only
// when there IS a first header to anchor on, so a tab with no section
// markers at all (its lyrics would all precede any header) is left alone.
function stripPreambleBeforeFirstHeader(lines) {
  const firstHeaderIndex = lines.findIndex((line) =>
    isHeaderLine(normalizeTabs(line).trim())
  );
  if (firstHeaderIndex <= 0) return lines;
  return lines.slice(firstHeaderIndex);
}

function parseContent(rawContent) {
  // Strip [tab]/[/tab] wrapper markers up front (rather than only inside
  // parseLine, where it happened before) — a [tab] block spanning several
  // raw lines only carries the literal tag text on its first/last line, and
  // the block-level passes below need to see the bare content on every line
  // to recognize e.g. a six-string tab-notation block as a whole.
  let lines = rawContent
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(WRAPPER_TAG_RE, ''));
  lines = stripPreambleBeforeFirstHeader(lines);
  lines = stripTabNotationBlocks(lines);
  const blocks = lines.map(parseLine);
  return mergeChordOnlyWithFollowingLyric(blocks);
}

module.exports = { parseContent, parseLine, buildChordLine };
