import { v4 as uuidv4 } from 'uuid';
import type { ParsedDynamic, ParsedLesson, ParsedNote } from './osmdParser';

export type ScoringConfig = {
  timingToleranceMs: number;
  velocityTolerance: number;
  pitchStrict: boolean;
  weights: { timing: number; pitch: number; velocity: number };
};

export type NoteEvent = {
  id: string;
  startBeat: number;
  durationBeats: number;
  midiNote: number | null;
  key: string | null;
  velocityTarget: number;
  absoluteBeat: number;
  measureIndex: number;
};

export type Measure = {
  index: number;
  beats: number;
  notes: NoteEvent[];
  dynamics?: DynamicMarking[];
};

export type DynamicMarking = {
  startBeat: number;
  type: DynamicLabel;
};

export type DynamicLabel =
  | 'ppp'
  | 'pp'
  | 'p'
  | 'mp'
  | 'mf'
  | 'f'
  | 'ff'
  | 'fff'
  | 'cresc'
  | 'dim';

export type Lesson = {
  id: string;
  title: string;
  timeSignature: [number, number];
  defaultTempo: number;
  keySignature: string | null;
  measures: Measure[];
  scoring: ScoringConfig;
  timeline: NoteEvent[];
};

const DEFAULT_SCORING: ScoringConfig = {
  timingToleranceMs: 200,
  velocityTolerance: 12,
  pitchStrict: true,
  weights: { timing: 0.4, pitch: 0.3, velocity: 0.3 },
};

type ExplicitDynamicLabel = Exclude<DynamicLabel, 'cresc' | 'dim'>;

const DYNAMIC_TARGETS: Record<ExplicitDynamicLabel, [number, number]> = {
  ppp: [10, 20],
  pp: [20, 30],
  p: [35, 45],
  mp: [50, 60],
  mf: [65, 75],
  f: [85, 95],
  ff: [100, 110],
  fff: [115, 125],
};

/**
 * Compute the midpoint of a numeric range.
 * @param range - Minimum and maximum values.
 * @returns Rounded midpoint value.
 */
function average([min, max]: [number, number]) {
  return Math.round((min + max) / 2);
}

/**
 * Check whether a dynamic label is an explicit level (not cresc/dim).
 * @param label - Dynamic label.
 * @returns True when label is explicit.
 */
function isExplicitDynamic(label: DynamicLabel): label is ExplicitDynamicLabel {
  return label !== 'cresc' && label !== 'dim';
}

/**
 * Normalize a parsed dynamic into a known dynamic label.
 * @param dynamic - Parsed dynamic from MusicXML.
 * @returns Normalized label or null when unsupported.
 */
function toDynamicLabel(dynamic: ParsedDynamic): DynamicLabel | null {
  const label = dynamic.type.toLowerCase() as DynamicLabel;
  if (
    label === 'cresc' ||
    label === 'dim' ||
    Object.prototype.hasOwnProperty.call(DYNAMIC_TARGETS, label)
  ) {
    return label;
  }
  return null;
}

/**
 * Convert parsed notes into normalized note events for a measure.
 * @param notes - Parsed notes.
 * @param measureIndex - Index of the parent measure.
 * @param beatsPerMeasure - Beats per measure from time signature.
 * @param activeTarget - Current velocity target.
 * @param toBeatValue - Converter for beat values.
 * @returns Normalized note events for the measure.
 */
function normalizeNotes(
  notes: ParsedNote[],
  measureIndex: number,
  beatsPerMeasure: number,
  activeTarget: number,
  toBeatValue: (value: number | null) => number | null,
) {
  const safeNotes = notes.filter(
    (note) => typeof note.midi === 'number' && note.midi !== null,
  );
  return safeNotes.map((note, noteIndex) => {
    const startBeat = toBeatValue(note.startBeat) ?? noteIndex;
    const durationBeats = toBeatValue(note.durationBeats) ?? 1;
    const absoluteBeat = measureIndex * beatsPerMeasure + startBeat;
    return {
      id: uuidv4(),
      startBeat,
      durationBeats,
      midiNote: note.midi ?? null,
      key: note.key ?? null,
      velocityTarget: activeTarget,
      absoluteBeat,
      measureIndex,
    };
  });
}

/**
 * Apply dynamics across the full lesson timeline.
 * @param measures - Lesson measures.
 * @param timeline - Flattened note events to update.
 * @param beatsPerMeasure - Beats per measure from time signature.
 * @param defaultTarget - Starting velocity target.
 */
function applyDynamicsAcrossTimeline(
  measures: Measure[],
  timeline: NoteEvent[],
  beatsPerMeasure: number,
  defaultTarget: number,
) {
  if (timeline.length === 0) return;

  const events = measures.flatMap((measure) => {
    const dynamics = measure.dynamics ?? [];
    return dynamics.map((dynamic) => ({
      type: dynamic.type,
      absoluteBeat: measure.index * beatsPerMeasure + dynamic.startBeat,
    }));
  });

  if (events.length === 0) {
    timeline.forEach((note) => {
      note.velocityTarget = defaultTarget;
    });
    return;
  }

  const sorted = events.sort((a, b) => {
    if (a.absoluteBeat !== b.absoluteBeat) {
      return a.absoluteBeat - b.absoluteBeat;
    }
    if (a.type === b.type) return 0;
    return isExplicitDynamic(a.type) ? -1 : 1;
  });

  let currentTarget = defaultTarget;
  let noteIndex = 0;
  const lastBeat = timeline[timeline.length - 1].absoluteBeat;
  const epsilon = 1e-6;

  /**
   * Advance through the timeline up to a given beat, applying current target.
   * @param beat - Absolute beat limit.
   */
  function advanceTo(beat: number) {
    while (
      noteIndex < timeline.length &&
      timeline[noteIndex].absoluteBeat < beat - epsilon
    ) {
      timeline[noteIndex].velocityTarget = currentTarget;
      noteIndex += 1;
    }
  }

  /**
   * Clamp velocity targets to MIDI range.
   * @param value - Proposed velocity target.
   * @returns Clamped velocity target.
   */
  function clampTarget(value: number) {
    return Math.max(1, Math.min(127, value));
  }

  for (let i = 0; i < sorted.length; i += 1) {
    const event = sorted[i];
    if (isExplicitDynamic(event.type)) {
      advanceTo(event.absoluteBeat);
      currentTarget = average(DYNAMIC_TARGETS[event.type]);
      continue;
    }

    advanceTo(event.absoluteBeat);

    let nextExplicit: (typeof sorted)[number] | null = null;
    for (let j = i + 1; j < sorted.length; j += 1) {
      if (isExplicitDynamic(sorted[j].type)) {
        nextExplicit = sorted[j];
        break;
      }
    }

    const endBeat = nextExplicit ? nextExplicit.absoluteBeat : lastBeat;
    const endTarget =
      nextExplicit && isExplicitDynamic(nextExplicit.type)
        ? average(DYNAMIC_TARGETS[nextExplicit.type])
        : currentTarget;
    const span = Math.max(endBeat - event.absoluteBeat, 0.0001);

    while (noteIndex < timeline.length) {
      const note = timeline[noteIndex];
      if (note.absoluteBeat > endBeat + epsilon) break;
      const progress = (note.absoluteBeat - event.absoluteBeat) / span;
      const target = currentTarget + (endTarget - currentTarget) * progress;
      note.velocityTarget = clampTarget(Math.round(target));
      noteIndex += 1;
    }

    currentTarget = endTarget;
  }

  while (noteIndex < timeline.length) {
    timeline[noteIndex].velocityTarget = currentTarget;
    noteIndex += 1;
  }
}

/**
 * Normalize a parsed lesson into the runtime lesson model.
 * @param parsed - Parsed lesson data from OSMD.
 * @param id - Lesson identifier.
 * @returns Normalized lesson data.
 */
export function normalizeLesson(parsed: ParsedLesson, id: string): Lesson {
  const timeSignature = parsed.timeSignature ?? [4, 4];
  const beatsPerMeasure = timeSignature[0];
  const beatUnit = timeSignature[1];
  const defaultTempo = parsed.tempoBpm ?? 60;
  const keySignature = parsed.keySignature ?? null;
  const measures: Measure[] = [];
  const timeline: NoteEvent[] = [];
  let lastTarget = average(DYNAMIC_TARGETS.mf);
  const rawValues = parsed.measures.flatMap((measure) =>
    measure.notes.flatMap((note) => [
      note.startBeat ?? 0,
      note.durationBeats ?? 0,
    ]),
  );
  const maxValue = rawValues.length > 0 ? Math.max(...rawValues) : 0;
  const usesWholeNoteFractions = maxValue > 0 && maxValue <= 1.01;

  /**
   * Convert a beat value based on whether values are in whole-note fractions.
   * @param value - Raw beat value.
   * @returns Converted beat value or null when missing.
   */
  function toBeatValue(value: number | null) {
    if (value === null) return null;
    return usesWholeNoteFractions ? value * beatUnit : value;
  }

  for (const measure of parsed.measures) {
    const dynamics = (measure.dynamics ?? [])
      .map((dynamic) => {
        const label = toDynamicLabel(dynamic);
        if (!label) return null;
        return {
          startBeat: toBeatValue(dynamic.startBeat) ?? 0,
          type: label,
        };
      })
      .filter((dynamic): dynamic is DynamicMarking => dynamic !== null);

    const preliminaryNotes = normalizeNotes(
      measure.notes,
      measure.index,
      beatsPerMeasure,
      lastTarget,
      toBeatValue,
    );
    if (preliminaryNotes.length > 0) {
      lastTarget = preliminaryNotes[preliminaryNotes.length - 1].velocityTarget;
    }

    measures.push({
      index: measure.index,
      beats: beatsPerMeasure,
      notes: preliminaryNotes,
      dynamics: dynamics.length > 0 ? dynamics : undefined,
    });
    timeline.push(...preliminaryNotes);
  }

  if (measures.length > 0) {
    const lastIndex = measures[measures.length - 1].index;
    const restMeasureIndex = lastIndex + 1;
    const restStartBeat = restMeasureIndex * beatsPerMeasure;
    const restNote: NoteEvent = {
      id: uuidv4(),
      startBeat: 0,
      durationBeats: beatsPerMeasure,
      midiNote: null,
      key: null,
      velocityTarget: lastTarget,
      absoluteBeat: restStartBeat,
      measureIndex: restMeasureIndex,
    };
    measures.push({
      index: restMeasureIndex,
      beats: beatsPerMeasure,
      notes: [restNote],
    });
  }

  applyDynamicsAcrossTimeline(measures, timeline, beatsPerMeasure, lastTarget);

  return {
    id,
    title: parsed.title,
    timeSignature,
    defaultTempo,
    keySignature,
    measures,
    scoring: DEFAULT_SCORING,
    timeline: timeline.sort((a, b) => a.absoluteBeat - b.absoluteBeat),
  };
}
