const HEADER_RE = /^\[[^[\]]+\]$/;
const CH_TAG_RE = /\[ch\](.*?)\[\/ch\]/gi;
const WRAPPER_TAG_RE = /\[\/?tab\]/gi;

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

function parseContent(rawContent) {
  const lines = rawContent.replace(/\r\n?/g, '\n').split('\n');
  const blocks = lines.map(parseLine);
  return mergeChordOnlyWithFollowingLyric(blocks);
}

module.exports = { parseContent, parseLine };
