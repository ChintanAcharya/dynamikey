const NOTE_LABELS = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
];

export function formatMidiNote(midiNote: number) {
  const name = NOTE_LABELS[midiNote % 12] ?? 'C';
  const octave = Math.floor(midiNote / 12) - 1;
  return `${name}${octave}`;
}
