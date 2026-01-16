import type { Lesson } from '../../musicxml/normalizeLesson';
import { getLessonLastBeat } from './lessonMetrics';
import { measureModifierWidth } from './layout';
import type { PreparedMeasure } from './measurePrep';

export type ScrollingLayoutConfig = {
  padding: number;
  rightPadding: number;
  lineHeight: number;
  topPadding: number;
  bottomPadding: number;
  pixelsPerBeat: number;
};

export type ScrollingMeasure = PreparedMeasure & {
  startBeat: number;
  width: number;
  showHeader: boolean;
};

export type ScrollingLayout = ScrollingLayoutConfig & {
  beatsPerMeasure: number;
  beatUnit: number;
  pixelsPerBeat: number;
  gridStepBeats: number;
  measures: ScrollingMeasure[];
  totalWidth: number;
  totalBeats: number;
};

export const DEFAULT_SCROLLING_LAYOUT: ScrollingLayoutConfig = {
  padding: 24,
  rightPadding: 20,
  lineHeight: 150,
  topPadding: 24,
  bottomPadding: 24,
  pixelsPerBeat: 64,
};

/**
 * Compute layout metrics for a scrolling, single-line staff.
 * @param lesson - Lesson data.
 * @param prepared - Prepared measure data.
 * @param config - Layout config.
 * @returns Layout data for scrolling rendering.
 */
export function buildScrollingLayout(
  lesson: Lesson,
  prepared: PreparedMeasure[],
  config: ScrollingLayoutConfig,
): ScrollingLayout {
  const [beatsPerMeasure, beatUnit] = lesson.timeSignature;
  const gridStepBeats = beatUnit / 16;
  const modifierWidths = {
    withHeader: measureModifierWidth(beatsPerMeasure, beatUnit, true, true),
    withoutHeader: measureModifierWidth(beatsPerMeasure, beatUnit, false, false),
  };

  const pixelsPerBeat = config.pixelsPerBeat;

  const measures = prepared.map((item) => {
    const showHeader = item.measureIndex === 0;
    const modifierWidth = showHeader
      ? modifierWidths.withHeader
      : modifierWidths.withoutHeader;
    const beatWidth = beatsPerMeasure * pixelsPerBeat;
    const noteWidth = Math.max(beatWidth, item.minNoteWidth);
    const width = modifierWidth + config.rightPadding + noteWidth;

    return {
      ...item,
      startBeat: item.measureIndex * beatsPerMeasure,
      width,
      showHeader,
    };
  });

  const totalWidth = measures.reduce((sum, item) => sum + item.width, 0);
  const totalBeats = getLessonLastBeat(lesson, beatsPerMeasure);

  return {
    ...config,
    beatsPerMeasure,
    beatUnit,
    pixelsPerBeat,
    gridStepBeats,
    measures,
    totalWidth,
    totalBeats,
  };
}
