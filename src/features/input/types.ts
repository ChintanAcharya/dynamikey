export type MidiNoteEventType = 'noteon' | 'noteoff';

export type MidiInputSource = 'mock' | 'webmidi';

export type MidiNoteEvent = {
  type: MidiNoteEventType;
  midiNote: number;
  velocity: number;
  timestamp: number;
  source: MidiInputSource;
};

export type MidiStatus =
  | 'idle'
  | 'requesting'
  | 'ready'
  | 'error'
  | 'unsupported';

export type KeyTone = 'white' | 'black';

export type KeyMapping = {
  key: string;
  midiNote: number;
  label: string;
  tone: KeyTone;
};
