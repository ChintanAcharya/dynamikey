import { Stave } from 'vexflow';

/**
 * Measure the width consumed by clef/key/time signature modifiers.
 * @param beats - Numerator of the time signature.
 * @param beatUnit - Denominator of the time signature.
 * @param showClef - Whether to include the clef.
 * @param showTime - Whether to include the time signature.
 * @param keySignature - Optional key signature string.
 * @returns Width in pixels for modifiers.
 */
export function measureModifierWidth(
  beats: number,
  beatUnit: number,
  showClef: boolean,
  showTime: boolean,
  keySignature: string | null,
) {
  // Use a probe stave to determine how much horizontal space modifiers consume.
  const probeStave = new Stave(0, 0, 120);
  if (showClef) {
    probeStave.addClef('treble');
  }
  if (showClef && keySignature) {
    probeStave.addKeySignature(keySignature);
  }
  if (showTime) {
    probeStave.addTimeSignature(`${beats}/${beatUnit}`);
  }
  return probeStave.getNoteStartX() - probeStave.getX();
}

/**
 * Compute the minimum width for a measure on a given line.
 * @param item - Prepared measure data.
 * @param isLineStart - Whether the measure is the first on the line.
 * @param modifierWidths - Cached modifier widths.
 * @param rightPadding - Extra padding on the right edge.
 * @returns Minimum width for the measure.
 */
export function minMeasureWidth(
  item: { minNoteWidth: number },
  isLineStart: boolean,
  modifierWidths: { withHeader: number; withoutHeader: number },
  rightPadding: number,
) {
  const modifierWidth = isLineStart
    ? modifierWidths.withHeader
    : modifierWidths.withoutHeader;
  return modifierWidth + rightPadding + item.minNoteWidth;
}

/**
 * Split measures into staff lines based on available width.
 * @param measures - Prepared measures.
 * @param usableWidth - Usable width for notes and modifiers.
 * @param modifierWidths - Cached modifier widths.
 * @param rightPadding - Extra padding on the right edge.
 * @returns Measures grouped into lines.
 */
export function splitMeasuresIntoLines<T extends { minNoteWidth: number }>(
  measures: T[],
  usableWidth: number,
  modifierWidths: { withHeader: number; withoutHeader: number },
  rightPadding: number,
) {
  const lines: T[][] = [];
  let currentLine: T[] = [];
  let currentWidth = 0;

  measures.forEach((item) => {
    if (currentLine.length === 0) {
      currentLine = [item];
      currentWidth = minMeasureWidth(item, true, modifierWidths, rightPadding);
      return;
    }

    const nextWidth =
      currentWidth + minMeasureWidth(item, false, modifierWidths, rightPadding);
    if (nextWidth > usableWidth) {
      lines.push(currentLine);
      currentLine = [item];
      currentWidth = minMeasureWidth(item, true, modifierWidths, rightPadding);
    } else {
      currentLine.push(item);
      currentWidth = nextWidth;
    }
  });

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Measure the width for a line of prepared measures.
 * @param line - Prepared measures on a line.
 * @param modifierWidths - Cached modifier widths.
 * @param rightPadding - Extra padding on the right edge.
 * @returns Total line width.
 */
export function lineWidth<T extends { minNoteWidth: number }>(
  line: T[],
  modifierWidths: { withHeader: number; withoutHeader: number },
  rightPadding: number,
) {
  return line.reduce(
    (sum, item, index) =>
      sum + minMeasureWidth(item, index === 0, modifierWidths, rightPadding),
    0,
  );
}
/**
 * Move a single measure to prevent an orphaned last line when possible.
 * @param lines - Measure lines.
 * @param usableWidth - Usable width for notes and modifiers.
 * @param modifierWidths - Cached modifier widths.
 * @param rightPadding - Extra padding on the right edge.
 * @returns Updated line grouping.
 */
export function rebalanceLines<T extends { minNoteWidth: number }>(
  lines: T[][],
  usableWidth: number,
  modifierWidths: { withHeader: number; withoutHeader: number },
  rightPadding: number,
) {
  if (lines.length < 2) return lines;

  // Avoid an orphaned last line if both lines still fit after moving one measure.
  const lastIndex = lines.length - 1;
  const prevLine = lines[lastIndex - 1];
  const lastLine = lines[lastIndex];

  if (lastLine.length !== 1 || prevLine.length <= 1) return lines;

  const moved = prevLine[prevLine.length - 1];
  const nextPrev = prevLine.slice(0, -1);
  const nextLast = [moved, ...lastLine];

  if (
    lineWidth(nextPrev, modifierWidths, rightPadding) <= usableWidth &&
    lineWidth(nextLast, modifierWidths, rightPadding) <= usableWidth
  ) {
    lines[lastIndex - 1] = nextPrev;
    lines[lastIndex] = nextLast;
  }

  return lines;
}
