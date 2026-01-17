import { Accidental, Formatter, GhostNote, Voice } from 'vexflow';
import type { Lesson } from '../../musicxml/normalizeLesson';
import { DYNAMICS_LINE, EPSILON } from './constants';
import { buildDynamicsVoice, isExplicitDynamic } from './dynamics';
import { beatsToDurationValue, splitBeatsToDurations } from './durations';
import { buildMeasureNotes } from './notes';
import type { DynamicEntry, NoteEntry } from './types';

export type PreparedMeasure = {
  voice: Voice;
  dynamicsVoices: Voice[];
  minNoteWidth: number;
  noteEntries: NoteEntry[];
  explicitEntries: DynamicEntry[];
  measureIndex: number;
  beatVoice: Voice;
  beatTickables: GhostNote[];
  beatOffsets: number[];
};

/**
 * Build VexFlow voices and metrics for each measure in the lesson.
 * @param lesson - Lesson data.
 * @returns Prepared measure data for layout and rendering.
 */
export function prepareMeasures(lesson: Lesson): PreparedMeasure[] {
  const [beats, beatUnit] = lesson.timeSignature;
  const keySignature = lesson.keySignature ?? 'C';

  return lesson.measures.map((measure) => {
    const { tickables, noteEntries } = buildMeasureNotes(measure, beatUnit);
    const voice = new Voice({ num_beats: beats, beat_value: beatUnit });
    voice.addTickables(tickables);
    Accidental.applyAccidentals([voice], keySignature);

    const explicitDynamics = buildDynamicsVoice(
      measure,
      beats,
      beatUnit,
      DYNAMICS_LINE,
      isExplicitDynamic,
      (type) => type,
    );
    const dynamicsVoices = explicitDynamics ? [explicitDynamics.voice] : [];

    const formatter = new Formatter();
    const voices = [voice, ...dynamicsVoices];
    formatter.joinVoices(voices);
    const minNoteWidth = formatter.preCalculateMinTotalWidth(voices);
    const gridStepBeats = beatUnit / 16;
    const gridDuration = String(beatsToDurationValue(gridStepBeats, beatUnit));
    const fullSteps = Math.floor((beats + EPSILON) / gridStepBeats);
    const remainderBeats = Number(
      (beats - fullSteps * gridStepBeats).toFixed(6),
    );
    const beatDurations = Array.from({ length: fullSteps }, () => gridDuration);
    if (remainderBeats > EPSILON) {
      beatDurations.push(...splitBeatsToDurations(remainderBeats, beatUnit));
    }
    const beatTickables = beatDurations.map(
      (duration) => new GhostNote(duration),
    );
    const beatOffsets: number[] = [];
    let offset = 0;
    beatDurations.forEach((duration) => {
      beatOffsets.push(offset);
      const durationBeats = beatUnit / Number(duration);
      offset = Number((offset + durationBeats).toFixed(6));
    });
    const beatVoice = new Voice({ num_beats: beats, beat_value: beatUnit });
    beatVoice.addTickables(beatTickables);

    return {
      voice,
      dynamicsVoices,
      minNoteWidth,
      noteEntries,
      explicitEntries: explicitDynamics?.entries ?? [],
      measureIndex: measure.index,
      beatVoice,
      beatTickables,
      beatOffsets,
    };
  });
}
