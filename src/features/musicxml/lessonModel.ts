export type ScoringConfig = {
  timingToleranceMs: number;
  velocityTolerance: number;
  pitchStrict: boolean;
  weights: { timing: number; pitch: number; velocity: number };
};

export type NoteEvent = {
  id: string;
  startBeat: number;
  durationBeats: number;
  midiNote: number | null;
  key: string | null;
  velocityTarget: number;
  absoluteBeat: number;
  measureIndex: number;
};

export type Measure = {
  index: number;
  beats: number;
  notes: NoteEvent[];
  dynamics?: DynamicMarking[];
};

export type DynamicMarking = {
  startBeat: number;
  type: DynamicLabel;
};

export type DynamicLabel =
  | 'ppp'
  | 'pp'
  | 'p'
  | 'mp'
  | 'mf'
  | 'f'
  | 'ff'
  | 'fff'
  | 'cresc'
  | 'dim';

export type Lesson = {
  id: string;
  title: string;
  timeSignature: [number, number];
  defaultTempo: number;
  keySignature: string | null;
  measures: Measure[];
  scoring: ScoringConfig;
  timeline: NoteEvent[];
};

export const DEFAULT_SCORING: ScoringConfig = {
  timingToleranceMs: 200,
  velocityTolerance: 12,
  pitchStrict: true,
  weights: { timing: 0.4, pitch: 0.3, velocity: 0.3 },
};
