const { buildChordLine } = require('./parser');

function chordName(chord) {
  return chord.baseNote.name + (chord.chordType?.suffix || '');
}

// Songsterr's chordpro line entries already carry chord segments
// interleaved in reading order with the lyric text (unlike UG's [ch] tags
// or chord-only-line-then-lyric-line pattern), so this just walks each
// segment in order, tracking the accumulated lyric length as the column to
// place the next chord at.
function parseLine(entry) {
  let lyricText = '';
  const chordPositions = [];

  for (const segment of entry.line) {
    if (segment.type === 'chord') {
      chordPositions.push({ chord: chordName(segment.chord), column: lyricText.length });
    } else {
      lyricText += segment.text || '';
    }
  }

  if (chordPositions.length === 0) {
    return { type: 'lyric', text: lyricText };
  }

  return {
    type: 'pair',
    chordLine: buildChordLine(lyricText.length, chordPositions),
    lyricLine: lyricText,
  };
}

// Songsterr revisions sometimes append a chord-reference chart after the
// real song content — e.g. every chord used, transposed into other keys,
// one bare chord per line with no lyric. There's no structural marker for
// this in the source data, but it reliably shows up as a run of trailing
// chord-only pair blocks (empty lyric line), so trim any such run off the
// end rather than rendering it as if it were part of the song.
function stripTrailingChordChart(blocks) {
  let end = blocks.length;
  while (end > 0) {
    const block = blocks[end - 1];
    if (block.type === 'pair' && block.lyricLine.trim() === '') {
      end--;
    } else {
      break;
    }
  }
  return blocks.slice(0, end);
}

function parseChordProLines(lines) {
  const blocks = lines.filter((entry) => entry.type === 'line').map(parseLine);
  return stripTrailingChordChart(blocks);
}

module.exports = { parseChordProLines };
