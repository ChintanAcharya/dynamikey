import { formatMidiNote } from '@/features/input/lib/noteUtils';

type MockKeyboardActiveNotesProps = {
  activeNotes: number[];
};

export function MockKeyboardActiveNotes({
  activeNotes,
}: MockKeyboardActiveNotesProps) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-black/40">
        Active notes
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {activeNotes.length === 0 ? (
          <span className="text-xs text-black/50">None</span>
        ) : null}
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
  );
}
