const NOTE_LABELS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Convert a MIDI note number into a readable label (ex: 60 -> C4).
 * @param midiNote - MIDI note number.
 * @returns Note label.
 */
export function formatMidiNote(midiNote: number) {
  const name = NOTE_LABELS[midiNote % 12] ?? 'C';
  const octave = Math.floor(midiNote / 12) - 1;
  return `${name}${octave}`;
}
