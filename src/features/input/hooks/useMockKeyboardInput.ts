import { useCallback, useEffect, useRef, useState } from 'react';

import { emitInput } from '@/features/input/lib/inputBus';
import {
  getEventTimestamp,
  KEY_TO_MIDI,
  shouldIgnoreKeyEvent,
} from '@/features/input/lib/keyLayout';

export function useMockKeyboardInput(velocity: number) {
  const activeKeysRef = useRef<Set<string>>(new Set());
  const [activeNotes, setActiveNotes] = useState<number[]>([]);

  const syncActiveNotes = useCallback(() => {
    const nextNotes: number[] = [];
    activeKeysRef.current.forEach((key) => {
      const midiNote = KEY_TO_MIDI[key];
      if (typeof midiNote === 'number') {
        nextNotes.push(midiNote);
      }
    });

    nextNotes.sort((left, right) => left - right);
    setActiveNotes(nextNotes);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (shouldIgnoreKeyEvent(event) || event.repeat) {
        return;
      }

      const key = event.key.toLowerCase();
      const midiNote = KEY_TO_MIDI[key];
      if (typeof midiNote !== 'number') {
        return;
      }

      if (activeKeysRef.current.has(key)) {
        return;
      }

      activeKeysRef.current.add(key);
      syncActiveNotes();
      emitInput({
        type: 'noteon',
        midiNote,
        velocity,
        timestamp: getEventTimestamp(event),
        source: 'mock',
      });
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (shouldIgnoreKeyEvent(event)) {
        return;
      }

      const key = event.key.toLowerCase();
      const midiNote = KEY_TO_MIDI[key];
      if (typeof midiNote !== 'number' || !activeKeysRef.current.has(key)) {
        return;
      }

      activeKeysRef.current.delete(key);
      syncActiveNotes();
      emitInput({
        type: 'noteoff',
        midiNote,
        velocity: 0,
        timestamp: getEventTimestamp(event),
        source: 'mock',
      });
    };

    const handleBlur = (event: FocusEvent) => {
      if (activeKeysRef.current.size === 0) {
        return;
      }

      const keys = Array.from(activeKeysRef.current.values());
      activeKeysRef.current.clear();
      syncActiveNotes();

      keys.forEach((key) => {
        const midiNote = KEY_TO_MIDI[key];
        if (typeof midiNote !== 'number') {
          return;
        }

        emitInput({
          type: 'noteoff',
          midiNote,
          velocity: 0,
          timestamp: getEventTimestamp(event),
          source: 'mock',
        });
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [syncActiveNotes, velocity]);

  return { activeNotes };
}
