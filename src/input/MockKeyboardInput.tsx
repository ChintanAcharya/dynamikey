import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MidiNoteEvent } from './midiEvents';
import { emitMockInput } from './mockInputBus';
import { formatMidiNote } from './noteUtils';

type MockKeyboardInputProps = {
  onEvent?: (event: MidiNoteEvent) => void;
};

type KeyMapping = {
  key: string;
  midiNote: number;
  label: string;
  tone: 'white' | 'black';
};

const KEY_LAYOUT: KeyMapping[] = [
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

const KEY_TO_MIDI = KEY_LAYOUT.reduce<Record<string, number>>((acc, entry) => {
  acc[entry.key] = entry.midiNote;
  return acc;
}, {});

const MIN_VELOCITY = 1;
const MAX_VELOCITY = 127;

const shouldIgnoreKeyEvent = (event: KeyboardEvent) => {
  if (event.altKey || event.ctrlKey || event.metaKey) return true;
  const target = event.target;
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  );
};

/**
 * Capture computer keyboard events and emit mock MIDI note events.
 * @param props - Component props.
 * @returns React element.
 */
function MockKeyboardInput({ onEvent }: MockKeyboardInputProps) {
  const [velocity, setVelocity] = useState(96);
  const [activeNotes, setActiveNotes] = useState<number[]>([]);
  const [recentEvents, setRecentEvents] = useState<MidiNoteEvent[]>([]);
  const activeKeysRef = useRef<Set<string>>(new Set());

  const groupedKeys = useMemo(() => {
    const white: KeyMapping[] = [];
    const black: KeyMapping[] = [];
    for (const entry of KEY_LAYOUT) {
      if (entry.tone === 'white') {
        white.push(entry);
      } else {
        black.push(entry);
      }
    }
    return { white, black };
  }, []);

  const emitEvent = useCallback(
    (event: MidiNoteEvent) => {
      emitMockInput(event);
      onEvent?.(event);
      setRecentEvents((prev) => {
        const next = [event, ...prev];
        return next.slice(0, 6);
      });
    },
    [onEvent],
  );

  const syncActiveNotes = useCallback(() => {
    const nextNotes: number[] = [];
    activeKeysRef.current.forEach((key) => {
      const midiNote = KEY_TO_MIDI[key];
      if (typeof midiNote === 'number') {
        nextNotes.push(midiNote);
      }
    });
    nextNotes.sort((a, b) => a - b);
    setActiveNotes(nextNotes);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (shouldIgnoreKeyEvent(event)) return;
      if (event.repeat) return;
      const key = event.key.toLowerCase();
      const midiNote = KEY_TO_MIDI[key];
      if (typeof midiNote !== 'number') return;
      if (activeKeysRef.current.has(key)) return;
      activeKeysRef.current.add(key);
      syncActiveNotes();
      emitEvent({
        type: 'noteon',
        midiNote,
        velocity,
        timestamp: performance.now(),
        source: 'mock',
      });
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (shouldIgnoreKeyEvent(event)) return;
      const key = event.key.toLowerCase();
      const midiNote = KEY_TO_MIDI[key];
      if (typeof midiNote !== 'number') return;
      if (!activeKeysRef.current.has(key)) return;
      activeKeysRef.current.delete(key);
      syncActiveNotes();
      emitEvent({
        type: 'noteoff',
        midiNote,
        velocity: 0,
        timestamp: performance.now(),
        source: 'mock',
      });
    };

    const handleBlur = () => {
      if (activeKeysRef.current.size === 0) return;
      const keys = Array.from(activeKeysRef.current.values());
      activeKeysRef.current.clear();
      syncActiveNotes();
      keys.forEach((key) => {
        const midiNote = KEY_TO_MIDI[key];
        if (typeof midiNote !== 'number') return;
        emitEvent({
          type: 'noteoff',
          midiNote,
          velocity: 0,
          timestamp: performance.now(),
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
  }, [emitEvent, syncActiveNotes, velocity]);

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-black/40">
            Mock keyboard input
          </div>
          <p className="mt-1 text-sm text-black/60">
            Use A S D F G H J K for white keys and W E T Y U for black keys.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-black/40">
            Velocity
          </span>
          <input
            type="range"
            min={MIN_VELOCITY}
            max={MAX_VELOCITY}
            step={1}
            value={velocity}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (!Number.isNaN(value)) {
                setVelocity(value);
              }
            }}
            className="h-1 w-36 accent-black"
          />
          <span className="text-xs font-semibold text-black tabular-nums">
            {velocity}
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-black/40">
            Key map
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {groupedKeys.white.map((entry) => (
              <div
                key={entry.key}
                className="flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-black"
              >
                <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-semibold text-black/60">
                  {entry.label}
                </span>
                <span>{formatMidiNote(entry.midiNote)}</span>
              </div>
            ))}
            {groupedKeys.black.map((entry) => (
              <div
                key={entry.key}
                className="flex items-center gap-2 rounded-full border border-black/10 bg-black px-3 py-1 text-xs font-semibold text-white"
              >
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/80">
                  {entry.label}
                </span>
                <span>{formatMidiNote(entry.midiNote)}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-black/40">
            Active notes
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {activeNotes.length === 0 && (
              <span className="text-xs text-black/50">None</span>
            )}
            {activeNotes.map((midiNote) => (
              <span
                key={midiNote}
                className="rounded-full border border-black/10 bg-black/5 px-3 py-1 text-xs font-semibold text-black"
              >
                {formatMidiNote(midiNote)}
              </span>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-black/40">
            Recent events
          </div>
          <div className="mt-2 flex flex-col gap-2">
            {recentEvents.length === 0 && (
              <span className="text-xs text-black/50">
                Play a note to see events.
              </span>
            )}
            {recentEvents.map((event) => (
              <div
                key={`${event.timestamp}-${event.type}-${event.midiNote}`}
                className="rounded-xl border border-black/10 bg-black/5 px-3 py-2 text-xs text-black/70"
              >
                <div className="font-semibold text-black">
                  {event.type.toUpperCase()}
                </div>
                <div>
                  {formatMidiNote(event.midiNote)} • velocity{' '}
                  {event.velocity}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MockKeyboardInput;
