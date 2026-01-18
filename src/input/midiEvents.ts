export type MidiNoteEventType = 'noteon' | 'noteoff';

export type MidiInputSource = 'mock';

export type MidiNoteEvent = {
  type: MidiNoteEventType;
  midiNote: number;
  velocity: number;
  timestamp: number;
  source: MidiInputSource;
};
