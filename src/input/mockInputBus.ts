import type { MidiNoteEvent } from './midiEvents';

type MockInputListener = (event: MidiNoteEvent) => void;

const listeners = new Set<MockInputListener>();

/**
 * Broadcast a mock input event to subscribers.
 * @param event - Mock MIDI note event.
 */
export function emitMockInput(event: MidiNoteEvent) {
  listeners.forEach((listener) => listener(event));
}

/**
 * Subscribe to mock input events.
 * @param listener - Event listener callback.
 * @returns Unsubscribe handler.
 */
export function subscribeMockInput(listener: MockInputListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
