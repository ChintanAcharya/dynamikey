import { GhostNote, TextDynamics, TextNote, Tickable, Voice } from 'vexflow';
import type { Measure } from '@/features/musicxml/normalizeLesson';
import {
  DURATION_VALUES,
  DYNAMICS_GLYPH_SCALE,
  DYNAMICS_TEXT_SIZE,
  EPSILON,
} from './constants';
import { splitBeatsToDurations } from './durations';
import type { DynamicEntry } from '../types';

/**
 * Determine whether a dynamic marking is explicit (not cresc/dim).
 * @param type - Dynamic type string.
 * @returns True when the marking is explicit.
 */
export function isExplicitDynamic(type: string) {
  return type !== 'cresc' && type !== 'dim';
}

/**
 * Build a dynamics tickable for glyph-based or text-based markings.
 * @param label - Dynamic label to render.
 * @param duration - VexFlow duration string.
 * @param line - Staff line for placement.
 * @returns TextDynamics or TextNote tickable.
 */
function createDynamicsTickable(label: string, duration: string, line: number) {
  const isGlyphText = /^[fpmzrs]+$/.test(label);
  if (isGlyphText) {
    const dynamics = new TextDynamics({ text: label, duration }).setLine(line);
    const glyphSize = dynamics.render_options?.glyph_font_size;
    if (typeof glyphSize === 'number') {
      dynamics.render_options.glyph_font_size =
        glyphSize * DYNAMICS_GLYPH_SCALE;
    }
    return dynamics;
  }

  const text = new TextNote({ text: label, duration }).setLine(line);
  text.setFontSize(DYNAMICS_TEXT_SIZE);
  return text;
}

/**
 * Build a VexFlow voice for dynamics aligned to measure beats.
 * @param measure - Lesson measure data.
 * @param beats - Numerator of the time signature.
 * @param beatUnit - Denominator of the time signature.
 * @param line - Staff line for placement.
 * @param filter - Predicate for dynamic types.
 * @param labelFor - Mapping from dynamic type to rendered label.
 * @returns Voice and entries, or null when no dynamics match.
 */
export function buildDynamicsVoice(
  measure: Measure,
  beats: number,
  beatUnit: number,
  line: number,
  filter: (type: string) => boolean,
  labelFor: (type: string) => string,
) {
  const dynamics = (measure.dynamics ?? []).filter((dynamic) =>
    filter(dynamic.type),
  );
  if (dynamics.length === 0) return null;

  // Fill the voice with ghost notes so dynamics align to actual beats.
  const sorted = [...dynamics].sort((a, b) => a.startBeat - b.startBeat);
  const tickables: Tickable[] = [];
  const entries: DynamicEntry[] = [];
  let cursor = 0;
  const minBeat = beatUnit / DURATION_VALUES[DURATION_VALUES.length - 1];
  /**
   * Compare beats with epsilon tolerance to avoid floating error issues.
   * @param a - First beat value.
   * @param b - Second beat value.
   * @returns True when values are effectively equal.
   */
  function equals(a: number, b: number) {
    return Math.abs(a - b) < EPSILON;
  }

  let index = 0;
  while (index < sorted.length) {
    const dynamic = sorted[index];
    const startBeat = Math.max(dynamic.startBeat ?? 0, 0);
    if (startBeat > cursor) {
      const gapDurations = splitBeatsToDurations(startBeat - cursor, beatUnit);
      gapDurations.forEach((duration) => {
        tickables.push(new GhostNote(duration));
      });
    }

    let nextIndex = index + 1;
    while (
      nextIndex < sorted.length &&
      equals(sorted[nextIndex].startBeat, startBeat)
    ) {
      nextIndex += 1;
    }

    const nextBeat =
      nextIndex < sorted.length
        ? (sorted[nextIndex].startBeat ?? beats)
        : beats;
    // Ensure a non-zero span so VexFlow can render the tickable.
    const span = Math.max(nextBeat - startBeat, minBeat);
    const durations = splitBeatsToDurations(span, beatUnit);
    const [dynamicDuration, ...restDurations] = durations;

    const label = labelFor(dynamic.type);
    const tickable = createDynamicsTickable(
      label,
      dynamicDuration ?? String(DURATION_VALUES[DURATION_VALUES.length - 1]),
      line,
    );
    tickables.push(tickable);
    entries.push({
      absoluteBeat: measure.index * beats + startBeat,
      tickable,
    });
    restDurations.forEach((duration) => {
      tickables.push(new GhostNote(duration));
    });
    cursor = startBeat + span;
    index = nextIndex;
  }

  if (cursor + EPSILON < beats) {
    const remainingDurations = splitBeatsToDurations(beats - cursor, beatUnit);
    remainingDurations.forEach((duration) => {
      tickables.push(new GhostNote(duration));
    });
  }

  const voice = new Voice({ num_beats: beats, beat_value: beatUnit });
  voice.setStrict(false);
  voice.addTickables(tickables);
  return { voice, entries };
}
