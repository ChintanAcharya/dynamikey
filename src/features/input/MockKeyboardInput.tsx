import { useMemo } from 'react';
import { formatMidiNote } from './noteUtils';
import { KEY_LAYOUT, useInputRuntime } from './InputRuntimeContext';

type KeyMapping = {
  key: string;
  midiNote: number;
  label: string;
  tone: 'white' | 'black';
};

const MIN_VELOCITY = 1;
const MAX_VELOCITY = 127;

/**
 * Capture computer keyboard events and emit mock MIDI note events.
 * @returns React element.
 */
function MockKeyboardInput() {
  const { activeNotes, recentMockEvents, setVelocity, velocity } =
    useInputRuntime();
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
            {recentMockEvents.length === 0 && (
              <span className="text-xs text-black/50">
                Play a note to see events.
              </span>
            )}
            {recentMockEvents.map((event) => (
              <div
                key={`${event.timestamp}-${event.type}-${event.midiNote}`}
                className="rounded-xl border border-black/10 bg-black/5 px-3 py-2 text-xs text-black/70"
              >
                <div className="font-semibold text-black">
                  {event.type.toUpperCase()}
                </div>
                <div>
                  {formatMidiNote(event.midiNote)} • velocity {event.velocity}
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
