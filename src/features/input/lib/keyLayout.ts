import type { KeyMapping } from '@/features/input/types';

export const KEY_LAYOUT: KeyMapping[] = [
  { key: 'a', midiNote: 60, label: 'A', tone: 'white' },
  { key: 'w', midiNote: 61, label: 'W', tone: 'black' },
  { key: 's', midiNote: 62, label: 'S', tone: 'white' },
  { key: 'e', midiNote: 63, label: 'E', tone: 'black' },
  { key: 'd', midiNote: 64, label: 'D', tone: 'white' },
  { key: 'f', midiNote: 65, label: 'F', tone: 'white' },
  { key: 't', midiNote: 66, label: 'T', tone: 'black' },
  { key: 'g', midiNote: 67, label: 'G', tone: 'white' },
  { key: 'y', midiNote: 68, label: 'Y', tone: 'black' },
  { key: 'h', midiNote: 69, label: 'H', tone: 'white' },
  { key: 'u', midiNote: 70, label: 'U', tone: 'black' },
  { key: 'j', midiNote: 71, label: 'J', tone: 'white' },
  { key: 'k', midiNote: 72, label: 'K', tone: 'white' },
];

export const KEY_TO_MIDI = KEY_LAYOUT.reduce<Record<string, number>>(
  (accumulator, entry) => {
    accumulator[entry.key] = entry.midiNote;
    return accumulator;
  },
  {},
);

export function getEventTimestamp(event: Event) {
  if (Number.isFinite(event.timeStamp) && event.timeStamp > 0) {
    return event.timeStamp;
  }

  return performance.now();
}

export function shouldIgnoreKeyEvent(event: KeyboardEvent) {
  if (event.altKey || event.ctrlKey || event.metaKey) {
    return true;
  }

  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  );
}
