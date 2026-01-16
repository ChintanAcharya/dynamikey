import type { Lesson } from '../../musicxml/normalizeLesson';

/**
 * Determine the last absolute beat in the lesson timeline.
 * @param lesson - Lesson data.
 * @param beatsPerMeasure - Numerator of the time signature.
 * @returns Absolute beat at the lesson end.
 */
export function getLessonLastBeat(lesson: Lesson, beatsPerMeasure: number) {
  const lastTimelineBeat =
    lesson.timeline.length > 0
      ? lesson.timeline.reduce(
          (maxBeat, note) =>
            Math.max(maxBeat, note.absoluteBeat + note.durationBeats),
          0,
        )
      : null;

  const lastMeasure = lesson.measures[lesson.measures.length - 1];
  const measureEnd = lastMeasure
    ? (lastMeasure.index + 1) * beatsPerMeasure
    : 0;

  if (typeof lastTimelineBeat === 'number') {
    return Math.max(lastTimelineBeat, measureEnd);
  }

  return measureEnd;
}
