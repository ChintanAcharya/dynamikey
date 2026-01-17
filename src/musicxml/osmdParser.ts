import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import type {
  Fraction,
  Note,
  SourceMeasure,
  SourceStaffEntry,
} from 'opensheetmusicdisplay';

export type ParsedNote = {
  id: string;
  midi: number | null;
  key: string | null;
  startBeat: number | null;
  durationBeats: number | null;
};

export type ParsedDynamic = {
  type: string;
  startBeat: number | null;
};

export type ParsedMeasure = {
  index: number;
  notes: ParsedNote[];
  dynamics: ParsedDynamic[];
};

export type ParsedLesson = {
  title: string;
  timeSignature: [number, number] | null;
  tempoBpm: number | null;
  keySignature: string | null;
  measures: ParsedMeasure[];
  diagnostics: {
    totalMeasures: number;
    totalNotes: number;
    totalDynamics: number;
  };
};

const DYNAMIC_LABELS = [
  'ppp',
  'pp',
  'p',
  'mp',
  'mf',
  'f',
  'ff',
  'fff',
  'cresc',
  'dim',
];

type StaffExpressions = SourceMeasure['StaffLinkedExpressions'][number];

// Mirrors OSMD's DynamicEnum numeric order.
const OSMD_DYNAMIC_ENUM_LABELS = [
  'pppppp',
  'ppppp',
  'pppp',
  'ppp',
  'pp',
  'p',
  'mp',
  'mf',
  'f',
  'ff',
  'fff',
  'ffff',
  'fffff',
  'ffffff',
  'sf',
  'sff',
  'sfp',
  'sfpp',
  'fp',
  'rf',
  'rfz',
  'sfz',
  'sffz',
  'fz',
  'other',
];

const CONTINUOUS_DYNAMIC_LABELS: Record<number, string> = {
  0: 'cresc',
  1: 'dim',
};

type KeyMode = 'major' | 'minor';

const MAJOR_KEY_SIGNATURES: Record<number, string> = {
  '-7': 'Cb',
  '-6': 'Gb',
  '-5': 'Db',
  '-4': 'Ab',
  '-3': 'Eb',
  '-2': 'Bb',
  '-1': 'F',
  0: 'C',
  1: 'G',
  2: 'D',
  3: 'A',
  4: 'E',
  5: 'B',
  6: 'F#',
  7: 'C#',
};

const MINOR_KEY_SIGNATURES: Record<number, string> = {
  '-7': 'Abm',
  '-6': 'Ebm',
  '-5': 'Bbm',
  '-4': 'Fm',
  '-3': 'Cm',
  '-2': 'Gm',
  '-1': 'Dm',
  0: 'Am',
  1: 'Em',
  2: 'Bm',
  3: 'F#m',
  4: 'C#m',
  5: 'G#m',
  6: 'D#m',
  7: 'A#m',
};

/**
 * Normalize a MusicXML mode string to major/minor.
 * @param mode - Raw mode string.
 * @returns Normalized key mode.
 */
function normalizeKeyMode(mode: string | null): KeyMode {
  if (!mode) return 'major';
  const normalized = mode.trim().toLowerCase();
  if (normalized === 'minor' || normalized === 'aeolian') {
    return 'minor';
  }
  return 'major';
}

/**
 * Convert fifths + mode into a VexFlow key signature string.
 * @param fifths - Circle of fifths value from MusicXML.
 * @param mode - Key mode.
 * @returns VexFlow key signature string or null when unavailable.
 */
function mapFifthsToKeySignature(
  fifths: number,
  mode: KeyMode,
): string | null {
  const map = mode === 'minor' ? MINOR_KEY_SIGNATURES : MAJOR_KEY_SIGNATURES;
  return map[fifths] ?? null;
}

/**
 * Parse the key signature from MusicXML.
 * @param xml - MusicXML document string.
 * @returns VexFlow key signature string or null when missing.
 */
function parseXmlKeySignature(xml: string): string | null {
  const parser = new DOMParser();
  const document = parser.parseFromString(xml, 'application/xml');
  const keyNode = document.querySelector('part > measure attributes > key');
  if (!keyNode) return null;
  const fifthsText = keyNode.querySelector('fifths')?.textContent;
  if (!fifthsText) return null;
  const fifths = Number(fifthsText);
  if (Number.isNaN(fifths)) return null;
  const modeText = keyNode.querySelector('mode')?.textContent ?? null;
  return mapFifthsToKeySignature(fifths, normalizeKeyMode(modeText));
}

/**
 * Read the real-value from an OSMD Fraction.
 * @param fraction - Fraction value from OSMD.
 * @returns Numeric value or null when absent.
 */
function readFractionValue(fraction: Fraction): number | null {
  return fraction.RealValue;
}

/**
 * Normalize a raw dynamic label into a supported short label.
 * @param raw - Raw dynamic label string.
 * @returns Normalized label or null when unsupported.
 */
function normalizeDynamicLabel(raw: string) {
  const normalized = raw.toLowerCase().replace(/\s+/g, '');
  return DYNAMIC_LABELS.find((label) => normalized.includes(label)) ?? null;
}

/**
 * Map OSMD DynamicEnum numeric values to a normalized label.
 * @param dynamicEnum - OSMD DynamicEnum value.
 * @returns Normalized label or null when unknown.
 */
function dynamicEnumToLabel(dynamicEnum: number): string | null {
  const label = OSMD_DYNAMIC_ENUM_LABELS[dynamicEnum];
  if (typeof label !== 'string') return null;
  return normalizeDynamicLabel(label);
}

/**
 * Normalize a continuous dynamic into a supported label.
 * @param dynamic - OSMD continuous dynamic object.
 * @returns Normalized label or null when unsupported.
 */
function continuousDynamicToLabel(dynamic: {
  Label: string;
  DynamicType: number;
}) {
  const normalized = normalizeDynamicLabel(dynamic.Label);
  if (normalized) return normalized;
  const fallback = CONTINUOUS_DYNAMIC_LABELS[dynamic.DynamicType];
  return fallback ? normalizeDynamicLabel(fallback) : null;
}

/**
 * Extract the MIDI value from an OSMD note.
 * @param note - OSMD note.
 * @returns MIDI half-tone value or null when absent.
 */
function extractMidi(note: Note): number | null {
  return note.halfTone;
}

const NOTE_ENUM_TO_STEP: Record<number, string> = {
  0: 'C',
  2: 'D',
  4: 'E',
  5: 'F',
  7: 'G',
  9: 'A',
  11: 'B',
};

/**
 * Convert an OSMD accidental enum to a key-string symbol.
 * @param accidental - Accidental enum value.
 * @returns Accidentals as '#', 'b', or empty string.
 */
function accidentalToSymbol(accidental: number | null | undefined) {
  if (accidental === 0) return '#';
  if (accidental === 1) return 'b';
  return '';
}

/**
 * Derive a VexFlow key string from an OSMD note pitch.
 * @param note - OSMD note.
 * @returns VexFlow key string or null when unavailable.
 */
function extractPitchKey(note: Note): string | null {
  const pitch = note.Pitch;

  const fundamental = pitch.FundamentalNote;
  const octave = pitch.Octave;
  const accidental = pitch.Accidental;

  if (typeof fundamental === 'number' && typeof octave === 'number') {
    const step = NOTE_ENUM_TO_STEP[fundamental];
    if (!step) return null;
    const symbol = accidentalToSymbol(accidental);
    return `${step.toLowerCase()}${symbol}/${octave}`;
  }

  const asString =
    (typeof pitch?.ToStringShort === 'function' && pitch.ToStringShort()) ||
    pitch?.ToStringShortGet;

  if (typeof asString === 'string') {
    const match = asString.match(/^([A-Ga-g])([#b]?)(-?\d+)/);
    if (!match) return null;
    const [, step, accidentalSymbol, octaveString] = match;
    return `${step.toLowerCase()}${accidentalSymbol}/${octaveString}`;
  }

  return null;
}

/**
 * Convert MusicXML alter values into accidental symbols.
 * @param alter - Alter value from MusicXML.
 * @returns Accidentals string or empty string.
 */
function alterToSymbol(alter: number | null) {
  if (alter === null) return '';
  if (alter === -2) return 'bb';
  if (alter === -1) return 'b';
  if (alter === 1) return '#';
  if (alter === 2) return '##';
  return '';
}

/**
 * Parse note pitch keys directly from MusicXML.
 * @param xml - MusicXML document string.
 * @returns Per-measure arrays of key strings.
 */
function parseXmlNoteKeys(xml: string) {
  const parser = new DOMParser();
  const document = parser.parseFromString(xml, 'application/xml');
  const measures = Array.from(document.querySelectorAll('part > measure'));
  return measures.map((measure) => {
    const keys: string[] = [];
    const notes = Array.from(measure.querySelectorAll('note'));
    for (const note of notes) {
      if (note.querySelector('rest')) continue;
      const step = note.querySelector('pitch > step')?.textContent;
      const octave = note.querySelector('pitch > octave')?.textContent;
      const alterRaw = note.querySelector('pitch > alter')?.textContent;
      if (!step || !octave) continue;
      const alter = alterRaw ? Number(alterRaw) : null;
      const symbol = alterToSymbol(Number.isNaN(alter) ? null : alter);
      keys.push(`${step.toLowerCase()}${symbol}/${octave}`);
    }
    return keys;
  });
}

/**
 * Parse dynamic markings from MusicXML direction entries.
 * @param xml - MusicXML document string.
 * @param defaultBeatUnit - Beat unit to use until time signatures appear.
 * @returns Per-measure dynamics collected from directions and wedges.
 */
function parseXmlDynamics(xml: string, defaultBeatUnit: number) {
  const parser = new DOMParser();
  const document = parser.parseFromString(xml, 'application/xml');
  const measures = Array.from(document.querySelectorAll('part > measure'));
  let currentDivisions = 1;
  let currentBeatUnit = defaultBeatUnit;

  return measures.map((measure) => {
    const measureDynamics: ParsedDynamic[] = [];
    const divisionsNode = measure.querySelector('attributes > divisions');
    const divisionsValue = divisionsNode
      ? Number(divisionsNode.textContent)
      : null;
    if (divisionsValue && !Number.isNaN(divisionsValue)) {
      currentDivisions = divisionsValue;
    }
    const beatTypeNode = measure.querySelector('attributes > time > beat-type');
    const beatTypeValue = beatTypeNode
      ? Number(beatTypeNode.textContent)
      : null;
    if (beatTypeValue && !Number.isNaN(beatTypeValue)) {
      currentBeatUnit = beatTypeValue;
    }

    const directions = Array.from(measure.querySelectorAll('direction'));
    for (const direction of directions) {
      const offsetNode = direction.querySelector('offset');
      const offsetValue = offsetNode ? Number(offsetNode.textContent) : 0;
      const startBeat =
        offsetValue && !Number.isNaN(offsetValue)
          ? offsetValue / currentDivisions / currentBeatUnit
          : 0;
      const dynamicsNode = direction.querySelector('direction-type > dynamics');
      if (dynamicsNode) {
        const children = Array.from(dynamicsNode.children);
        for (const child of children) {
          const tag = child.tagName?.toLowerCase();
          if (!tag) continue;
          measureDynamics.push({ type: tag, startBeat });
        }
      }
      const wedgeNode = direction.querySelector('direction-type > wedge');
      if (wedgeNode) {
        const wedgeType = wedgeNode.getAttribute('type')?.toLowerCase();
        if (wedgeType === 'crescendo') {
          measureDynamics.push({ type: 'cresc', startBeat });
        }
        if (wedgeType === 'diminuendo') {
          measureDynamics.push({ type: 'dim', startBeat });
        }
      }
      const wordsNode = direction.querySelector('direction-type > words');
      if (wordsNode?.textContent) {
        const text = wordsNode.textContent.toLowerCase();
        if (text.includes('cresc')) {
          measureDynamics.push({ type: 'cresc', startBeat });
        }
        if (text.includes('dim')) {
          measureDynamics.push({ type: 'dim', startBeat });
        }
      }
    }

    return measureDynamics;
  });
}

/**
 * Extract a note's duration in beats from OSMD.
 * @param note - OSMD note.
 * @returns Duration in beats or null when missing.
 */
function extractDuration(note: Note): number | null {
  return note.Length.RealValue;
}

/**
 * Read the time signature from the first measure.
 * @param sourceMeasures - Measures from OSMD.
 * @returns Time signature tuple or null when missing.
 */
function extractTimeSignature(
  sourceMeasures: SourceMeasure[],
): [number, number] | null {
  const firstMeasure = sourceMeasures[0];

  const timeSig = firstMeasure.ActiveTimeSignature;

  const numerator = timeSig.Numerator;
  const denominator = timeSig.Denominator;

  if (typeof numerator === 'number' && typeof denominator === 'number') {
    return [numerator, denominator];
  }

  return null;
}

/**
 * Extract the tempo in BPM from the first measure.
 * @param sourceMeasures - Measures from OSMD.
 * @returns Tempo in BPM or null when missing.
 */
function extractTempo(sourceMeasures: SourceMeasure[]): number | null {
  const firstMeasure = sourceMeasures[0];
  return firstMeasure.TempoInBPM;
}

/**
 * Extract dynamics that align with a staff entry timestamp.
 * @param entry - Staff entry to inspect.
 * @param startBeat - Beat value for the entry.
 * @returns Dynamics detected from staff-linked expressions.
 */
function extractDynamicsFromEntry(
  entry: SourceStaffEntry,
  startBeat: number | null,
) {
  const parentMeasure = entry.VerticalContainerParent?.ParentMeasure;
  const staffIndex = entry.ParentStaff?.idInMusicSheet;
  if (!parentMeasure || typeof staffIndex !== 'number') return [];
  const expressions = parentMeasure.StaffLinkedExpressions[staffIndex] ?? [];
  return extractDynamicsFromExpressions(expressions, entry.Timestamp, startBeat);
}

/**
 * Extract unique dynamics for a timestamped expression collection.
 * @param expressions - Staff-linked expressions.
 * @param entryTimestamp - Timestamp to match.
 * @param startBeat - Beat to assign to detected dynamics.
 * @returns Parsed dynamics for the entry timestamp.
 */
function extractDynamicsFromExpressions(
  expressions: StaffExpressions,
  entryTimestamp: Fraction,
  startBeat: number | null,
) {
  const dynamics: ParsedDynamic[] = [];
  const seenLabels = new Set<string>();
  for (const expression of expressions) {
    if (!expression.Timestamp.Equals(entryTimestamp)) continue;
    const candidates: Array<string | null> = [];

    const instantaneous = expression.InstantaneousDynamic;
    if (instantaneous && typeof instantaneous.DynEnum === 'number') {
      candidates.push(dynamicEnumToLabel(instantaneous.DynEnum));
    }

    const continuous = expression.StartingContinuousDynamic;
    if (continuous) {
      candidates.push(continuousDynamicToLabel(continuous));
    }

    if (expression.CombinedExpressionsText) {
      candidates.push(normalizeDynamicLabel(expression.CombinedExpressionsText));
    }

    for (const candidate of candidates) {
      if (!candidate || seenLabels.has(candidate)) continue;
      seenLabels.add(candidate);
      dynamics.push({ type: candidate, startBeat });
    }
  }
  return dynamics;
}

/**
 * Convert OSMD measures and XML fallbacks into parsed measure data.
 * @param sourceMeasures - Measures from OSMD.
 * @param xmlKeys - Per-measure key strings from raw XML.
 * @param xmlDynamics - Per-measure dynamics parsed from raw XML.
 * @returns Parsed measures plus diagnostics totals.
 */
function extractMeasures(
  sourceMeasures: SourceMeasure[],
  xmlKeys: string[][],
  xmlDynamics: ParsedDynamic[][],
) {
  const measures: ParsedMeasure[] = [];
  let totalNotes = 0;
  let totalDynamics = 0;

  sourceMeasures.forEach((measure, index) => {
    const noteEvents: ParsedNote[] = [];
    const dynamics: ParsedDynamic[] = [];
    const containers = measure.VerticalSourceStaffEntryContainers;

    /**
     * Read notes and dynamics for a single staff entry.
     * @param entry - Staff entry to process.
     */
    function processEntry(entry: SourceStaffEntry) {
      const voiceEntries = entry.VoiceEntries;
      const entryStartBeat = readFractionValue(entry.Timestamp);
      if (Array.isArray(voiceEntries)) {
        for (const voiceEntry of voiceEntries) {
          const startBeat = readFractionValue(voiceEntry.Timestamp);
          const notes = voiceEntry.Notes;
          if (Array.isArray(notes)) {
            for (const note of notes) {
              const fallbackKey = extractPitchKey(note);
              const xmlKey = xmlKeys[index]?.[noteEvents.length] ?? null;
              noteEvents.push({
                id: `m${index + 1}-n${noteEvents.length + 1}`,
                midi: extractMidi(note),
                key: xmlKey ?? fallbackKey,
                startBeat,
                durationBeats: extractDuration(note),
              });
            }
          }
        }
      }
      dynamics.push(...extractDynamicsFromEntry(entry, entryStartBeat));
    }

    if (Array.isArray(containers) && containers.length > 0) {
      for (const container of containers) {
        const staffEntries = container.StaffEntries;
        for (const entry of staffEntries) {
          processEntry(entry);
        }
      }
    } else {
      const staffCount = measure.CompleteNumberOfStaves;
      for (let staffIndex = 0; staffIndex < staffCount; staffIndex += 1) {
        const staffEntries = measure.getEntriesPerStaff(staffIndex);
        for (const entry of staffEntries) {
          processEntry(entry);
        }
      }
    }

    totalNotes += noteEvents.length;
    const dynamicKey = new Set(
      dynamics.map((dynamic) => `${dynamic.type}-${dynamic.startBeat ?? 0}`),
    );
    const fallbackDynamics = xmlDynamics[index] ?? [];
    for (const dynamic of fallbackDynamics) {
      const key = `${dynamic.type}-${dynamic.startBeat ?? 0}`;
      if (dynamicKey.has(key)) continue;
      dynamics.push(dynamic);
      dynamicKey.add(key);
    }

    totalDynamics += dynamics.length;

    measures.push({
      index,
      notes: noteEvents,
      dynamics,
    });
  });

  return { measures, totalNotes, totalDynamics };
}

/**
 * Parse a MusicXML lesson using OSMD and XML fallbacks.
 * @param xml - MusicXML document string.
 * @returns Parsed lesson summary and diagnostics.
 */
export async function parseLessonFromXml(xml: string): Promise<ParsedLesson> {
  const osmd = new OpenSheetMusicDisplay(document.createElement('div'), {
    autoResize: false,
    drawTitle: false,
  });

  await osmd.load(xml);

  const sheet = osmd.Sheet;
  const sourceMeasures = sheet.SourceMeasures;

  const timeSignature = extractTimeSignature(sourceMeasures);
  const keySignature = parseXmlKeySignature(xml);
  const xmlKeys = parseXmlNoteKeys(xml);
  const xmlDynamics = parseXmlDynamics(xml, timeSignature?.[1] ?? 4);

  const { measures, totalNotes, totalDynamics } = extractMeasures(
    sourceMeasures,
    xmlKeys,
    xmlDynamics,
  );

  return {
    title: sheet?.Title?.text ?? 'Untitled Lesson',
    timeSignature,
    tempoBpm: extractTempo(sourceMeasures),
    keySignature,
    measures,
    diagnostics: {
      totalMeasures: sourceMeasures.length,
      totalNotes,
      totalDynamics,
    },
  };
}
