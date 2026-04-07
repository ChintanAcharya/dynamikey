import { useMemo } from 'react';
import { formatMidiNote } from './noteUtils';
import { KEY_LAYOUT, useInputRuntime } from './InputRuntimeContext';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

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
  const { activeNotes, setVelocity, velocity } = useInputRuntime();

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
    <Card>
      <CardHeader>
        <CardTitle>Mock keyboard input</CardTitle>
        <CardDescription>
          Simulate MIDI note events using your computer keyboard.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div>
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

        <div className="mt-4">
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
      </CardContent>
    </Card>
  );
}

export default MockKeyboardInput;
