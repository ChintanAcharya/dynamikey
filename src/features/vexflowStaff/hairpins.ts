import { Modifier, StaveHairpin, TextDynamics, TextNote } from 'vexflow';
import type { Measure } from '@/features/musicxml/normalizeLesson';
import {
  DYNAMICS_GLYPH_SCALE,
  DYNAMICS_LINE,
  EPSILON,
  HAIRPIN_HEIGHT,
  HAIRPIN_LEFT_SHIFT_PX,
  HAIRPIN_RIGHT_SHIFT_PX,
  HAIRPIN_Y_OFFSET,
} from './constants';
import { isExplicitDynamic } from './dynamics';
import type {
  DynamicEntry,
  HairpinSpan,
  NoteEntry,
  VexFlowContext,
} from './types';

/**
 * Convert dynamics across measures into hairpin spans.
 * @param measures - Lesson measures.
 * @param beatsPerMeasure - Numerator of the time signature.
 * @param lastBeat - Absolute beat for the end of the lesson.
 * @returns Hairpin spans derived from cresc/dim markings.
 */
export function collectHairpinSpans(
  measures: Measure[],
  beatsPerMeasure: number,
  lastBeat: number,
) {
  const events = measures.flatMap((measure) => {
    const dynamics = measure.dynamics ?? [];
    return dynamics.map((dynamic) => ({
      type: dynamic.type,
      absoluteBeat: measure.index * beatsPerMeasure + dynamic.startBeat,
    }));
  });

  if (events.length === 0) return [];

  const sorted = [...events].sort((a, b) => {
    if (a.absoluteBeat !== b.absoluteBeat)
      return a.absoluteBeat - b.absoluteBeat;
    if (a.type === b.type) return 0;
    return isExplicitDynamic(a.type) ? -1 : 1;
  });

  // Convert cresc/dim events into spans that end at the next explicit dynamic.
  const spans: HairpinSpan[] = [];

  for (let i = 0; i < sorted.length; i += 1) {
    const event = sorted[i];
    if (event.type !== 'cresc' && event.type !== 'dim') continue;

    let nextExplicit: typeof event | null = null;
    for (let j = i + 1; j < sorted.length; j += 1) {
      if (isExplicitDynamic(sorted[j].type)) {
        nextExplicit = sorted[j];
        break;
      }
    }

    const endBeat = nextExplicit ? nextExplicit.absoluteBeat : lastBeat;
    spans.push({
      type: event.type,
      startBeat: event.absoluteBeat,
      endBeat,
    });
  }

  return spans;
}

/**
 * Choose the first and last note entries that overlap a hairpin span.
 * @param noteEntries - Notes within a rendered staff line.
 * @param startBeat - Hairpin start beat.
 * @param endBeat - Hairpin end beat.
 * @returns Selected notes for anchoring, or null if none overlap.
 */
function selectHairpinNotes(
  noteEntries: NoteEntry[],
  startBeat: number,
  endBeat: number,
) {
  if (noteEntries.length === 0) return null;
  const epsilon = 1e-6;
  // Find the first/last notes that overlap the span for hairpin anchoring.
  const startIndex = noteEntries.findIndex(
    (entry) => entry.absoluteBeat >= startBeat - epsilon,
  );
  if (startIndex === -1) return null;
  let endIndex = noteEntries.length - 1;
  for (let i = noteEntries.length - 1; i >= 0; i -= 1) {
    if (noteEntries[i].absoluteBeat <= endBeat + epsilon) {
      endIndex = i;
      break;
    }
  }
  if (endIndex < startIndex) return null;
  return {
    first: noteEntries[startIndex].note,
    last: noteEntries[endIndex].note,
  };
}

/**
 * Compute an anchor X position for a dynamic tickable.
 * @param tickable - Dynamic tickable.
 * @returns X coordinate for hairpin alignment, or null if unavailable.
 */
function getDynamicAnchorX(tickable: TextDynamics | TextNote) {
  const entryX = tickable.getAbsoluteX?.();
  const entryWidth = tickable.getWidth?.();
  if (typeof entryX !== 'number' || typeof entryWidth !== 'number') return null;

  // TextDynamics glyphs need special handling to align hairpins to the glyph center.
  if (tickable instanceof TextDynamics) {
    return entryX + (entryWidth * DYNAMICS_GLYPH_SCALE) / 2;
  }

  const tickContext = tickable.checkTickContext(
    'Dynamics tickable missing context.',
  );
  const glyphOffset = tickContext.getMetrics().glyphPx / 2;
  return entryX + glyphOffset + entryWidth / 2;
}

/**
 * Draw hairpins for a single rendered staff line.
 * @param params - Rendering inputs for the line.
 */
export function drawHairpins(params: {
  context: VexFlowContext;
  noteEntries: NoteEntry[];
  dynamicEntries: DynamicEntry[];
  hairpinSpans: HairpinSpan[];
}) {
  const { context, noteEntries, dynamicEntries, hairpinSpans } = params;
  if (noteEntries.length === 0) return;

  const lineStart = noteEntries[0].absoluteBeat;
  const lineEnd = noteEntries[noteEntries.length - 1].absoluteBeat;
  /**
   * Locate a dynamic entry at a specific beat with epsilon tolerance.
   * @param beat - Absolute beat to search for.
   * @returns Matching dynamic entry when found.
   */
  function findDynamicAtBeat(beat: number) {
    return dynamicEntries.find(
      (entry) => Math.abs(entry.absoluteBeat - beat) < EPSILON,
    );
  }

  const referenceStave = noteEntries[0].note.checkStave();
  const staffBottom = referenceStave.getY() + referenceStave.getHeight();
  const dynamicY = referenceStave.getYForLine(DYNAMICS_LINE - 3);
  const dynamicHeight = referenceStave.getSpacingBetweenLines();

  // Compute a vertical offset so hairpins sit between the staff and dynamics text.
  const hairpinYShift =
    dynamicY -
    staffBottom -
    20 +
    dynamicHeight / 2 -
    HAIRPIN_HEIGHT / 2 +
    HAIRPIN_Y_OFFSET;

  hairpinSpans.forEach((span) => {
    if (span.endBeat < lineStart || span.startBeat > lineEnd) return;
    const segmentStart = Math.max(span.startBeat, lineStart);
    const segmentEnd = Math.min(span.endBeat, lineEnd);
    const selection = selectHairpinNotes(noteEntries, segmentStart, segmentEnd);
    if (!selection) return;
    const hairpinType =
      span.type === 'cresc'
        ? StaveHairpin.type.CRESC
        : StaveHairpin.type.DECRESC;
    const startEntry = findDynamicAtBeat(span.startBeat);
    const endEntry = findDynamicAtBeat(span.endBeat);
    const startX = selection.first.getModifierStartXY(
      Modifier.Position.BELOW,
      0,
    ).x;
    const endX = selection.last.getModifierStartXY(
      Modifier.Position.BELOW,
      0,
    ).x;
    let leftShift = HAIRPIN_LEFT_SHIFT_PX;
    let rightShift = HAIRPIN_RIGHT_SHIFT_PX;

    if (startEntry) {
      const anchorX = getDynamicAnchorX(startEntry.tickable);
      if (typeof anchorX === 'number') {
        leftShift = anchorX - startX;
      }
    }

    if (endEntry) {
      const anchorX = getDynamicAnchorX(endEntry.tickable);
      if (typeof anchorX === 'number') {
        rightShift = anchorX - endX;
      }
    }

    new StaveHairpin(
      { first_note: selection.first, last_note: selection.last },
      hairpinType,
    )
      .setContext(context)
      .setPosition(Modifier.Position.BELOW)
      .setRenderOptions({
        height: HAIRPIN_HEIGHT,
        y_shift: hairpinYShift,
        left_shift_px: leftShift,
        right_shift_px: rightShift,
        left_shift_ticks: 0,
        right_shift_ticks: 0,
      })
      .draw();
  });
}
