import { Accidental, StaveNote, Tickable } from 'vexflow';
import type { Measure } from '../../musicxml/normalizeLesson';
import type { NoteEntry } from './types';
import { beatsToDurationValue, midiToKey } from './durations';

/**
 * Extract the accidental symbol from a VexFlow key string.
 * @param key - VexFlow key string (ex: c#/4).
 * @returns Accidental symbol or null when none is present.
 */
function getAccidentalFromKey(key: string) {
  const match = key.match(/^[a-g]([#b]{1,2}|n)\//);
  return match ? match[1] : null;
}

/**
 * Build VexFlow tickables and note entries for a measure.
 * @param measure - Lesson measure data.
 * @param beatUnit - Denominator of the time signature.
 * @returns Tickables plus note entries for hairpin anchoring.
 */
export function buildMeasureNotes(measure: Measure, beatUnit: number) {
  const tickables: Tickable[] = [];
  const noteEntries: NoteEntry[] = [];

  for (const note of measure.notes) {
    const key =
      note.key ??
      (typeof note.midiNote === 'number' ? midiToKey(note.midiNote) : null);
    const duration = String(beatsToDurationValue(note.durationBeats, beatUnit));

    if (!key) {
      const restNote = new StaveNote({
        keys: ['b/4'],
        duration: `${duration}r`,
      });
      tickables.push(restNote);
      continue;
    }

    const staveNote = new StaveNote({ keys: [key], duration });
    const accidental = getAccidentalFromKey(key);
    if (accidental) {
      staveNote.addModifier(new Accidental(accidental), 0);
    }
    tickables.push(staveNote);
    noteEntries.push({
      id: note.id,
      note: staveNote,
      absoluteBeat: note.absoluteBeat,
      durationBeats: note.durationBeats,
    });
  }

  return { tickables, noteEntries };
}
