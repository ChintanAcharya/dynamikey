import type { MidiNoteEvent } from './midiEvents';

type InputListener = (event: MidiNoteEvent) => void;

const listeners = new Set<InputListener>();

/**
 * Broadcast an input event to subscribers.
 * @param event - MIDI note event.
 */
export function emitInput(event: MidiNoteEvent) {
  listeners.forEach((listener) => listener(event));
}

/**
 * Subscribe to input events.
 * @param listener - Event listener callback.
 * @returns Unsubscribe handler.
 */
export function subscribeInput(listener: InputListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
