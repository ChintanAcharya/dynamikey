import { useMemo } from 'react';

import { formatMidiNote } from '@/features/input/lib/noteUtils';
import { KEY_LAYOUT } from '@/features/input/lib/keyLayout';
import type { KeyMapping } from '@/features/input/types';

type KeyGroups = {
  black: KeyMapping[];
  white: KeyMapping[];
};

function groupKeys() {
  const groups: KeyGroups = {
    black: [],
    white: [],
  };

  for (const entry of KEY_LAYOUT) {
    groups[entry.tone].push(entry);
  }

  return groups;
}

export function MockKeyboardKeyMap() {
  const groupedKeys = useMemo(() => groupKeys(), []);

  return (
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
    </div>
  );
}
