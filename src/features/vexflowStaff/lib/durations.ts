import { DURATION_VALUES, EPSILON, NOTE_NAMES } from './constants';

/**
 * Convert a MIDI note number to a VexFlow key string (ex: 60 -> c/4).
 * @param midi - MIDI note number.
 * @returns VexFlow key string.
 */
export function midiToKey(midi: number) {
  const name = NOTE_NAMES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}/${octave}`;
}

/**
 * Pick the nearest supported VexFlow duration value for a beat length.
 * @param beats - Duration in beats.
 * @param beatUnit - Denominator of the time signature.
 * @returns VexFlow duration value (ex: 4 for quarter).
 */
export function beatsToDurationValue(beats: number, beatUnit: number) {
  // Quantize to the closest supported duration to avoid invalid VexFlow values.
  if (beats <= 0) return DURATION_VALUES[DURATION_VALUES.length - 1];
  let best = DURATION_VALUES[DURATION_VALUES.length - 1];
  let bestDiff = Number.POSITIVE_INFINITY;

  for (const value of DURATION_VALUES) {
    const durationBeats = beatUnit / value;
    const diff = Math.abs(beats - durationBeats);
    if (diff < EPSILON) return value;
    if (diff < bestDiff) {
      best = value;
      bestDiff = diff;
    }
  }

  return best;
}

/**
 * Split a span of beats into VexFlow duration strings.
 * @param beats - Duration in beats.
 * @param beatUnit - Denominator of the time signature.
 * @returns Array of VexFlow duration strings.
 */
export function splitBeatsToDurations(beats: number, beatUnit: number) {
  const durations: string[] = [];
  let remaining = Math.max(beats, 0);

  // Greedy split into supported VexFlow durations to keep tickables aligned.
  for (const value of DURATION_VALUES) {
    const beatValue = beatUnit / value;
    while (remaining + EPSILON >= beatValue) {
      durations.push(String(value));
      remaining = Number((remaining - beatValue).toFixed(6));
    }
  }

  if (durations.length === 0 && beats > 0) {
    durations.push(String(DURATION_VALUES[DURATION_VALUES.length - 1]));
  }

  return durations;
}
