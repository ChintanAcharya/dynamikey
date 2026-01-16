import type { Renderer, StaveNote, TextDynamics, TextNote } from 'vexflow';

export type VexFlowContext = ReturnType<Renderer['getContext']>;
export type NoteEntry = { note: StaveNote; absoluteBeat: number };
export type DynamicEntry = { absoluteBeat: number; tickable: TextDynamics | TextNote };
export type HairpinSpan = {
  type: 'cresc' | 'dim';
  startBeat: number;
  endBeat: number;
};
