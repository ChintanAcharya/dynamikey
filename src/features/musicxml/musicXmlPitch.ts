import { asserts, elements } from '@stringsync/musicxml';

type KeyMode = 'major' | 'minor';

const STEP_TO_SEMITONE: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

const MAJOR_KEY_SIGNATURES: Record<number, string> = {
  '-7': 'Cb',
  '-6': 'Gb',
  '-5': 'Db',
  '-4': 'Ab',
  '-3': 'Eb',
  '-2': 'Bb',
  '-1': 'F',
  0: 'C',
  1: 'G',
  2: 'D',
  3: 'A',
  4: 'E',
  5: 'B',
  6: 'F#',
  7: 'C#',
};

const MINOR_KEY_SIGNATURES: Record<number, string> = {
  '-7': 'Abm',
  '-6': 'Ebm',
  '-5': 'Bbm',
  '-4': 'Fm',
  '-3': 'Cm',
  '-2': 'Gm',
  '-1': 'Dm',
  0: 'Am',
  1: 'Em',
  2: 'Bm',
  3: 'F#m',
  4: 'C#m',
  5: 'G#m',
  6: 'D#m',
  7: 'A#m',
};

/**
 * Normalize a MusicXML mode string to major/minor.
 * @param mode - Raw mode string.
 * @returns Normalized key mode.
 */
function normalizeKeyMode(mode: string | null): KeyMode {
  if (!mode) return 'major';
  const normalized = mode.trim().toLowerCase();
  if (normalized === 'minor' || normalized === 'aeolian') {
    return 'minor';
  }
  return 'major';
}

/**
 * Convert fifths + mode into a VexFlow key signature string.
 * @param fifths - Circle of fifths value from MusicXML.
 * @param mode - Key mode.
 * @returns VexFlow key signature string or null when unavailable.
 */
function mapFifthsToKeySignature(fifths: number, mode: KeyMode): string | null {
  const map = mode === 'minor' ? MINOR_KEY_SIGNATURES : MAJOR_KEY_SIGNATURES;
  return map[fifths] ?? null;
}

/**
 * Convert MusicXML alteration values into accidental symbols.
 * @param alter - Semitone adjustment from the pitch.
 * @returns Accidentals string.
 */
function alterToSymbol(alter: number | null) {
  if (alter === null) return '';
  if (alter === -2) return 'bb';
  if (alter === -1) return 'b';
  if (alter === 1) return '#';
  if (alter === 2) return '##';
  return '';
}

/**
 * Extract a key signature from a MusicXML key element.
 * @param key - Key element to inspect.
 * @returns VexFlow-compatible key signature string or null.
 */
export function extractKeySignature(key: elements.Key): string | null {
  const value = key.getValue();
  if (!asserts.isTranditionalKey(value)) return null;

  const fifths = value[1].getValue();
  if (typeof fifths !== 'number') return null;

  const mode = normalizeKeyMode(value[2]?.getMode() ?? null);
  return mapFifthsToKeySignature(fifths, mode);
}

/**
 * Convert a pitch into a VexFlow key string and MIDI number.
 * @param pitch - Parsed MusicXML pitch.
 * @returns Key and MIDI values.
 */
export function extractPitch(pitch: elements.Pitch) {
  const step = pitch.getStep().getStep();
  const octave = pitch.getOctave().getOctave();
  const alter = pitch.getAlter()?.getSemitones() ?? null;
  const symbol = alterToSymbol(alter);
  const semitone = STEP_TO_SEMITONE[step];

  return {
    key: `${step.toLowerCase()}${symbol}/${octave}`,
    midi:
      typeof semitone === 'number'
        ? (octave + 1) * 12 + semitone + (alter ?? 0)
        : null,
  };
}
