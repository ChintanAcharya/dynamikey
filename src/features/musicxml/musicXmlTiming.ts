import { asserts, elements } from '@stringsync/musicxml';

export type TimeSignature = [number, number];

const NOTE_TYPE_TO_WHOLE_VALUE: Record<string, number> = {
  maxima: 8,
  long: 4,
  breve: 2,
  whole: 1,
  half: 0.5,
  quarter: 0.25,
  eighth: 0.125,
  '16th': 0.0625,
  '32nd': 0.03125,
  '64th': 0.015625,
  '128th': 0.0078125,
  '256th': 0.00390625,
  '512th': 0.001953125,
  '1024th': 0.0009765625,
};

/**
 * Convert divisions into transport beats for the current beat unit.
 * @param divisionValue - Duration or offset in MusicXML divisions.
 * @param divisionsPerQuarter - Divisions per quarter note.
 * @param beatUnit - Time-signature denominator.
 * @returns Beat count in lesson beat units.
 */
export function divisionsToBeats(
  divisionValue: number,
  divisionsPerQuarter: number,
  beatUnit: number,
) {
  return (divisionValue / divisionsPerQuarter) * (beatUnit / 4);
}

/**
 * Convert a note type plus dot count into a whole-note duration.
 * @param noteType - MusicXML beat unit value.
 * @param dotCount - Number of augmentation dots.
 * @returns Whole-note duration or null when unsupported.
 */
function noteTypeToWholeValue(noteType: string, dotCount: number) {
  const baseValue = NOTE_TYPE_TO_WHOLE_VALUE[noteType];
  if (baseValue === undefined) return null;

  let multiplier = 1;
  for (let i = 1; i <= dotCount; i += 1) {
    multiplier += 1 / 2 ** i;
  }

  return baseValue * multiplier;
}

/**
 * Extract a time signature from a MusicXML time element.
 * @param time - Time element to inspect.
 * @returns Time signature tuple or null when unavailable.
 */
export function extractTimeSignature(
  time: elements.Time,
): TimeSignature | null {
  const value = time.getValue();
  if (!asserts.isTimeSignature(value)) return null;

  const firstPair = value[0][0];
  const numerator = Number(firstPair?.[0]?.getText());
  const denominator = Number(firstPair?.[1]?.getText());

  if (Number.isNaN(numerator) || Number.isNaN(denominator)) {
    return null;
  }

  return [numerator, denominator];
}

/**
 * Extract a tempo value from a metronome direction when no sound tempo exists.
 * @param metronome - Metronome element from MusicXML.
 * @param beatUnit - Time-signature denominator.
 * @returns Tempo in lesson beat units per minute, or null.
 */
export function extractTempoFromMetronome(
  metronome: elements.Metronome,
  beatUnit: number,
) {
  const value = metronome.getMetronome();
  if (!Array.isArray(value) || value.length !== 4) return null;

  const baseBeatUnit = value[0];
  const dots = value[1];
  const perMinute = value[3];

  if (!(perMinute instanceof elements.PerMinute)) {
    return null;
  }

  const perMinuteValue = Number(perMinute.getText());
  if (Number.isNaN(perMinuteValue)) {
    return null;
  }

  const sourceWholeValue = noteTypeToWholeValue(
    baseBeatUnit.getNoteTypeValue(),
    dots.length,
  );
  const targetWholeValue = 1 / beatUnit;

  if (sourceWholeValue === null || targetWholeValue <= 0) {
    return perMinuteValue;
  }

  return perMinuteValue * (sourceWholeValue / targetWholeValue);
}
