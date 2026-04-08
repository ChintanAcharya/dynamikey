import { MusicXML, asserts, elements } from '@stringsync/musicxml';
import { v4 as uuidv4 } from 'uuid';

import {
  dynamicElementToLabel,
  normalizeDynamicLabel,
  parseXmlDynamics,
  pushDynamic,
  type MusicXmlDynamicEvent,
} from './musicXmlDynamics';
import { extractKeySignature, extractPitch } from './musicXmlPitch';
import {
  divisionsToBeats,
  extractTempoFromMetronome,
  extractTimeSignature,
  type TimeSignature,
} from './musicXmlTiming';
import {
  DEFAULT_SCORING,
  type DynamicLabel,
  type DynamicMarking,
  type Lesson,
  type Measure,
  type NoteEvent,
} from './lessonModel';

type NoteVariation =
  | elements.TiedNote
  | elements.CuedNote
  | elements.TiedGraceNote
  | elements.CuedGraceNote;

type RawNote = {
  midi: number | null;
  key: string | null;
  startBeat: number | null;
  durationBeats: number | null;
};

type RawMeasure = {
  index: number;
  notes: RawNote[];
  dynamics: MusicXmlDynamicEvent[];
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
 * Extract the first explicit title available in the score header.
 * @param root - Parsed MusicXML root.
 * @returns Human-readable title.
 */
function extractTitle(root: elements.ScorePartwise) {
  const movementTitle = root.getMovementTitle()?.getText().trim();
  if (movementTitle) return movementTitle;

  const workTitle = root.getWork()?.getWorkTitle()?.getText().trim();
  if (workTitle) return workTitle;

  const primaryPartName = root
    .getPartList()
    .getScorePart()
    .getPartName()
    .getText()
    .trim();
  if (primaryPartName) return primaryPartName;

  return 'Untitled Lesson';
}

/**
 * Narrow a note variation to its content pieces.
 * @param variation - MusicXML note variation.
 * @returns Note timing and pitch payload.
 */
function extractVariationParts(variation: NoteVariation) {
  if (asserts.isTiedNote(variation)) {
    return {
      isChordTone: variation[0] !== null,
      noteLike: variation[1],
      duration: variation[2],
    };
  }

  if (asserts.isCuedNote(variation)) {
    return {
      isChordTone: variation[1] !== null,
      noteLike: variation[2],
      duration: variation[3],
    };
  }

  if (asserts.isTiedGraceNote(variation)) {
    return {
      isChordTone: variation[1] !== null,
      noteLike: variation[2],
      duration: null,
    };
  }

  return {
    isChordTone: variation[2] !== null,
    noteLike: variation[3],
    duration: variation[4],
  };
}

/**
 * Compute the midpoint of a numeric range.
 * @param range - Minimum and maximum values.
 * @returns Rounded midpoint value.
 */
function average([min, max]: [number, number]) {
  return Math.round((min + max) / 2);
}

/**
 * Check whether a dynamic label is an explicit level.
 * @param label - Dynamic label.
 * @returns True when label is explicit.
 */
function isExplicitDynamic(label: DynamicLabel): label is ExplicitDynamicLabel {
  return label !== 'cresc' && label !== 'dim';
}

/**
 * Normalize a parsed dynamic into a known dynamic label.
 * @param dynamic - Parsed dynamic event.
 * @returns Normalized label or null when unsupported.
 */
function toDynamicLabel(dynamic: MusicXmlDynamicEvent): DynamicLabel | null {
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
 * Convert raw note data into normalized note events for a measure.
 * @param notes - Parsed notes.
 * @param measureIndex - Index of the parent measure.
 * @param beatsPerMeasure - Beats per measure from time signature.
 * @param activeTarget - Current velocity target.
 * @param toBeatValue - Converter for beat values.
 * @returns Normalized note events for the measure.
 */
function normalizeNotes(
  notes: RawNote[],
  measureIndex: number,
  beatsPerMeasure: number,
  activeTarget: number,
  toBeatValue: (value: number | null) => number | null,
) {
  const safeNotes = notes.filter(
    (note) => typeof note.midi === 'number' && note.midi !== null,
  );

  return safeNotes.map((note, noteIndex): NoteEvent => {
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

  function advanceTo(beat: number) {
    while (
      noteIndex < timeline.length &&
      timeline[noteIndex].absoluteBeat < beat - epsilon
    ) {
      timeline[noteIndex].velocityTarget = currentTarget;
      noteIndex += 1;
    }
  }

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
 * Convert raw parsed score data into the runtime lesson model.
 * @param params - Raw lesson fields and identifiers.
 * @returns Runtime lesson data.
 */
function buildLesson(params: {
  id: string;
  title: string;
  timeSignature: TimeSignature | null;
  tempoBpm: number | null;
  keySignature: string | null;
  measures: RawMeasure[];
}) {
  const { id, title, measures: rawMeasures, tempoBpm, keySignature } = params;
  const timeSignature = params.timeSignature ?? [4, 4];
  const beatsPerMeasure = timeSignature[0];
  const beatUnit = timeSignature[1];
  const defaultTempo = tempoBpm ?? 60;
  const measures: Measure[] = [];
  const timeline: NoteEvent[] = [];
  let lastTarget = average(DYNAMIC_TARGETS.mf);
  const rawValues = rawMeasures.flatMap((measure) =>
    measure.notes.flatMap((note) => [
      note.startBeat ?? 0,
      note.durationBeats ?? 0,
    ]),
  );
  const maxValue = rawValues.length > 0 ? Math.max(...rawValues) : 0;
  const usesWholeNoteFractions = maxValue > 0 && maxValue <= 1.01;

  function toBeatValue(value: number | null) {
    if (value === null) return null;
    return usesWholeNoteFractions ? value * beatUnit : value;
  }

  for (const measure of rawMeasures) {
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
    title,
    timeSignature,
    defaultTempo,
    keySignature: keySignature ?? null,
    measures,
    scoring: DEFAULT_SCORING,
    timeline: timeline.sort((a, b) => a.absoluteBeat - b.absoluteBeat),
  } satisfies Lesson;
}

/**
 * Parse a MusicXML lesson into the runtime lesson model.
 * @param xml - Raw MusicXML document.
 * @param id - Lesson identifier.
 * @returns Runtime lesson data.
 */
export async function parseLessonFromXml(
  xml: string,
  id: string,
): Promise<Lesson> {
  const document = MusicXML.parse(xml);
  const root = document.getRoot();

  if (!(root instanceof elements.ScorePartwise)) {
    throw new Error('Only score-partwise MusicXML documents are supported.');
  }

  const part = root.getParts()[0];
  if (!part) {
    throw new Error('MusicXML document does not contain any parts.');
  }

  const measures: RawMeasure[] = [];
  const xmlDynamics = parseXmlDynamics(xml, 4);

  let lessonTimeSignature: TimeSignature | null = null;
  let lessonTempoBpm: number | null = null;
  let lessonKeySignature: string | null = null;

  let currentDivisions = 1;
  let currentTimeSignature: TimeSignature = [4, 4];

  for (const [measureIndex, measure] of part.getMeasures().entries()) {
    const noteEvents: RawNote[] = [];
    const dynamics: MusicXmlDynamicEvent[] = [];
    const seenDynamics = new Set<string>();

    let cursorDivisions = 0;
    let lastNoteStartDivisions = 0;

    for (const value of measure.getValues()) {
      if (value instanceof elements.Attributes) {
        const divisions = value.getDivisions()?.getPositiveDivisions();
        if (typeof divisions === 'number') {
          currentDivisions = divisions;
        }

        const time = value.getTimes()[0];
        const parsedTimeSignature = time ? extractTimeSignature(time) : null;
        if (parsedTimeSignature) {
          currentTimeSignature = parsedTimeSignature;
          if (!lessonTimeSignature) {
            lessonTimeSignature = parsedTimeSignature;
          }
        }

        const key = value.getKeys()[0];
        const parsedKeySignature = key ? extractKeySignature(key) : null;
        if (parsedKeySignature && !lessonKeySignature) {
          lessonKeySignature = parsedKeySignature;
        }

        continue;
      }

      if (value instanceof elements.Direction) {
        const beatUnit = currentTimeSignature[1];
        const offsetDivisions = value.getOffset()?.getValue() ?? 0;
        const startBeat = divisionsToBeats(
          cursorDivisions + offsetDivisions,
          currentDivisions,
          beatUnit,
        );

        const soundTempo = value.getSound()?.getTempo();
        if (lessonTempoBpm === null && typeof soundTempo === 'number') {
          lessonTempoBpm = soundTempo;
        }

        for (const directionType of value.getDirectionTypes()) {
          const item = directionType.getDirectionType();

          if (item instanceof elements.Wedge) {
            if (item.getType() === 'crescendo') {
              pushDynamic(dynamics, seenDynamics, 'cresc', startBeat);
            } else if (item.getType() === 'diminuendo') {
              pushDynamic(dynamics, seenDynamics, 'dim', startBeat);
            }
            continue;
          }

          if (item instanceof elements.Metronome && lessonTempoBpm === null) {
            const metronomeTempo = extractTempoFromMetronome(item, beatUnit);
            if (typeof metronomeTempo === 'number') {
              lessonTempoBpm = metronomeTempo;
            }
            continue;
          }

          if (Array.isArray(item)) {
            for (const nestedItem of item) {
              if (nestedItem instanceof elements.Dynamics) {
                nestedItem.getValue().forEach((dynamic) => {
                  pushDynamic(
                    dynamics,
                    seenDynamics,
                    dynamicElementToLabel(dynamic),
                    startBeat,
                  );
                });
                continue;
              }

              if (nestedItem instanceof elements.Words) {
                pushDynamic(
                  dynamics,
                  seenDynamics,
                  normalizeDynamicLabel(nestedItem.getText()),
                  startBeat,
                );
              }
            }
            continue;
          }

          if (item instanceof elements.Dynamics) {
            item.getValue().forEach((dynamic) => {
              pushDynamic(
                dynamics,
                seenDynamics,
                dynamicElementToLabel(dynamic),
                startBeat,
              );
            });
          }
        }

        continue;
      }

      if (value instanceof elements.Sound) {
        const tempo = value.getTempo();
        if (lessonTempoBpm === null && typeof tempo === 'number') {
          lessonTempoBpm = tempo;
        }
        continue;
      }

      if (value instanceof elements.Backup) {
        cursorDivisions -= value.getDuration().getPositiveDivisions();
        continue;
      }

      if (value instanceof elements.Forward) {
        cursorDivisions += value.getDuration().getPositiveDivisions();
        continue;
      }

      if (!(value instanceof elements.Note)) {
        continue;
      }

      const variation = value.getVariation();
      const { duration, isChordTone, noteLike } =
        extractVariationParts(variation);

      if (!duration) {
        continue;
      }

      const durationDivisions = duration.getPositiveDivisions();
      const startDivisions = isChordTone
        ? lastNoteStartDivisions
        : cursorDivisions;
      const beatUnit = currentTimeSignature[1];

      let midi: number | null = null;
      let key: string | null = null;

      if (noteLike instanceof elements.Pitch) {
        const extractedPitch = extractPitch(noteLike);
        midi = extractedPitch.midi;
        key = extractedPitch.key;
      }

      noteEvents.push({
        midi,
        key,
        startBeat: divisionsToBeats(startDivisions, currentDivisions, beatUnit),
        durationBeats: divisionsToBeats(
          durationDivisions,
          currentDivisions,
          beatUnit,
        ),
      });

      if (!isChordTone) {
        lastNoteStartDivisions = cursorDivisions;
        cursorDivisions += durationDivisions;
      }
    }

    for (const dynamic of xmlDynamics[measureIndex] ?? []) {
      pushDynamic(dynamics, seenDynamics, dynamic.type, dynamic.startBeat ?? 0);
    }

    measures.push({
      index: measureIndex,
      notes: noteEvents,
      dynamics,
    });
  }

  return buildLesson({
    id,
    title: extractTitle(root),
    timeSignature: lessonTimeSignature,
    tempoBpm: lessonTempoBpm,
    keySignature: lessonKeySignature,
    measures,
  });
}
