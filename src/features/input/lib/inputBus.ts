import type { MidiNoteEvent } from '@/features/input/types';

type InputListener = (event: MidiNoteEvent) => void;

const listeners = new Set<InputListener>();

export function emitInput(event: MidiNoteEvent) {
  listeners.forEach((listener) => listener(event));
}

export function subscribeInput(listener: InputListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
