import { Formatter, Renderer, Stave } from 'vexflow';
import type { Lesson } from '../../musicxml/normalizeLesson';
import { EPSILON } from './constants';
import { collectHairpinSpans, drawHairpins } from './hairpins';
import type { DynamicEntry, NoteEntry } from './types';
import { applyContextToVoices } from './voiceContext';
import { prepareMeasures } from './measurePrep';
import {
  buildScrollingLayout,
  DEFAULT_SCROLLING_LAYOUT,
  type ScrollingLayout,
  type ScrollingLayoutConfig,
  type ScrollingMeasure,
} from './scrollingLayout';

export type ScrollingRendererOptions = ScrollingLayoutConfig & {
  playheadOffsetRatio: number;
  overscanBeats: number;
};

export type ScrollingRenderer = {
  update: (currentBeat: number) => void;
  getPlayheadX: () => number;
  getHeight: () => number;
  destroy: () => void;
};

const DEFAULT_SCROLLING_OPTIONS: ScrollingRendererOptions = {
  ...DEFAULT_SCROLLING_LAYOUT,
  playheadOffsetRatio: 0.3,
  overscanBeats: 4,
};

const DEFAULT_NOTE_STYLE = {};
const HIGHLIGHT_NOTE_STYLE = {
  fillStyle: '#ef4444',
  strokeStyle: '#ef4444',
};

type WindowState = {
  key: string;
  startBeat: number;
  beatAnchors: Map<number, number>;
  lastAnchorX: number;
};

/**
 * Create a scrolling renderer for a lesson.
 * @param lesson - Lesson data.
 * @param renderRoot - Target element for SVG output.
 * @param viewportWidth - Width of the visible viewport.
 * @param options - Optional rendering options.
 * @returns Scrolling renderer instance.
 */
export function createScrollingLessonRenderer(
  lesson: Lesson,
  renderRoot: HTMLDivElement,
  viewportWidth: number,
  options?: Partial<ScrollingRendererOptions>,
): ScrollingRenderer {
  const config: ScrollingRendererOptions = {
    ...DEFAULT_SCROLLING_OPTIONS,
    ...options,
  };

  const prepared = prepareMeasures(lesson);
  const layout = buildScrollingLayout(lesson, prepared, config);
  const hairpinSpans = collectHairpinSpans(
    lesson.measures,
    layout.beatsPerMeasure,
    layout.totalBeats,
  );
  const height = layout.topPadding + layout.lineHeight + layout.bottomPadding;
  const playheadX = computePlayheadX(viewportWidth, layout, config);
  let windowState: WindowState | null = null;
  const allNoteEntries = prepared.flatMap((measure) => measure.noteEntries);
  let highlightedNotes: NoteEntry[] = [];
  let highlightKey = '';
  const gridStepBeats = layout.gridStepBeats;

  /**
   * Normalize beat values to stable map keys.
   * @param beat - Beat value to normalize.
   * @returns Normalized beat key.
   */
  const beatKey = (beat: number) => Number(beat.toFixed(6));

  renderRoot.style.willChange = 'transform';

  /**
   * Find all notes that are active for the current beat.
   * @param currentBeat - Current transport beat.
   * @returns Active note entries.
   */
  function getActiveNotes(currentBeat: number) {
    if (currentBeat < -EPSILON || currentBeat > layout.totalBeats + EPSILON) {
      return [];
    }
    return allNoteEntries.filter((entry) => {
      const start = entry.absoluteBeat;
      const end = entry.absoluteBeat + entry.durationBeats;
      return currentBeat + EPSILON >= start && currentBeat < end - EPSILON;
    });
  }

  /**
   * Apply highlight styles for the active notes.
   * @param currentBeat - Current transport beat.
   * @returns True when highlight state changes.
   */
  function updateHighlightedNotes(currentBeat: number) {
    const activeNotes = getActiveNotes(currentBeat);
    const nextKey = activeNotes.map((entry) => entry.id).join('|');
    if (nextKey === highlightKey) return false;

    highlightedNotes.forEach((entry) => {
      entry.note.setStyle(DEFAULT_NOTE_STYLE);
    });
    activeNotes.forEach((entry) => {
      entry.note.setStyle(HIGHLIGHT_NOTE_STYLE);
    });

    highlightedNotes = activeNotes;
    highlightKey = nextKey;
    return true;
  }

  /**
   * Render a window of measures to the SVG root.
   * @param windowMeasures - Measures to render.
   */
  function renderWindow(windowMeasures: ScrollingMeasure[]) {
    renderRoot.innerHTML = '';
    const renderer = new Renderer(renderRoot, Renderer.Backends.SVG);
    const context = renderer.getContext();
    const totalMeasuresWidth = windowMeasures.reduce(
      (sum, measure) => sum + measure.width,
      0,
    );
    const width = layout.padding * 2 + totalMeasuresWidth;
    renderer.resize(width, height);

    let x = layout.padding;
    const y = layout.topPadding;

    const lineNoteEntries: NoteEntry[] = [];
    const lineDynamicEntries: DynamicEntry[] = [];

    const beatAnchors = new Map<number, number>();
    let lastAnchorX = layout.padding;

    windowMeasures.forEach((item) => {
      const stave = new Stave(x, y, item.width);
      if (item.showHeader) {
        stave
          .addClef('treble')
          .addTimeSignature(`${layout.beatsPerMeasure}/${layout.beatUnit}`);
      }
      stave.setContext(context).draw();

      const formatter = new Formatter();
      const voices = [item.voice, ...item.dynamicsVoices, item.beatVoice];
      applyContextToVoices(context, voices);
      formatter.joinVoices(voices).formatToStave(voices, stave);
      voices.forEach((voice) => {
        if (voice !== item.beatVoice) {
          voice.draw(context, stave);
        }
      });

      lineNoteEntries.push(...item.noteEntries);
      lineDynamicEntries.push(...item.explicitEntries);

      const noteStartX = stave.getNoteStartX();
      const padding = Stave.defaultPadding - Stave.rightPadding;

      item.beatTickables.forEach((tickable, index) => {
        const offsetBeat = item.beatOffsets[index] ?? 0;
        const beat = item.startBeat + offsetBeat;
        tickable.setStave(stave);
        const tickContext = tickable.checkTickContext(
          'Missing tick context for beat anchor.',
        );
        const anchorX = tickContext.getX() + noteStartX + padding;
        beatAnchors.set(beatKey(beat), anchorX);
        lastAnchorX = anchorX;
      });
      x += item.width;
    });

    drawHairpins({
      context,
      noteEntries: lineNoteEntries,
      dynamicEntries: lineDynamicEntries,
      hairpinSpans,
    });
    return { beatAnchors, lastAnchorX };
  }

  /**
   * Determine which measures should be visible around the current beat.
   * @param currentBeat - Current transport beat.
   * @returns Windowed measure data and start beat.
   */
  function selectWindow(currentBeat: number) {
    const leftBeats = playheadX / layout.pixelsPerBeat;
    const rightBeats = (viewportWidth - playheadX) / layout.pixelsPerBeat;
    const minBeat = currentBeat - leftBeats - config.overscanBeats;
    const maxBeat = currentBeat + rightBeats + config.overscanBeats;

    const measures = layout.measures;
    let startIndex = measures.findIndex(
      (measure) =>
        measure.startBeat + layout.beatsPerMeasure >= minBeat - EPSILON,
    );
    if (startIndex < 0) {
      startIndex = Math.max(0, measures.length - 1);
    }

    let endIndex = measures.length - 1;
    for (let i = startIndex; i < measures.length; i += 1) {
      if (measures[i].startBeat > maxBeat + EPSILON) {
        endIndex = Math.max(startIndex, i - 1);
        break;
      }
    }

    const windowMeasures = measures.slice(startIndex, endIndex + 1);
    const windowStartBeat = windowMeasures[0]?.startBeat ?? 0;
    const key = `${startIndex}-${endIndex}`;

    return { windowMeasures, windowStartBeat, key };
  }

  /**
   * Update the renderer to match the current beat.
   * @param currentBeat - Current transport beat.
   */
  function update(currentBeat: number) {
    const clampedBeat = Math.max(0, Math.min(layout.totalBeats, currentBeat));
    const highlightChanged = updateHighlightedNotes(currentBeat);
    const currentGridBeat =
      Math.floor((clampedBeat + EPSILON) / gridStepBeats) * gridStepBeats;
    const nextGridBeat = Math.min(
      currentGridBeat + gridStepBeats,
      layout.totalBeats,
    );
    const progress =
      gridStepBeats > 0
        ? Math.max(
            0,
            Math.min(1, (clampedBeat - currentGridBeat) / gridStepBeats),
          )
        : 0;
    const { windowMeasures, windowStartBeat, key } =
      selectWindow(clampedBeat);
    if (windowMeasures.length === 0) return;
    if (!windowState || windowState.key !== key || highlightChanged) {
      const { beatAnchors, lastAnchorX } = renderWindow(windowMeasures);
      windowState = {
        key,
        startBeat: windowStartBeat,
        beatAnchors,
        lastAnchorX,
      };
    }

    const currentAnchor =
      windowState.beatAnchors.get(beatKey(currentGridBeat)) ??
      windowState.lastAnchorX;
    const nextAnchor =
      windowState.beatAnchors.get(beatKey(nextGridBeat)) ?? currentAnchor;
    const anchorX = currentAnchor + (nextAnchor - currentAnchor) * progress;
    const translateX = playheadX - anchorX;

    renderRoot.style.transform = `translateX(${translateX}px)`;
  }

  /**
   * Clean up rendered output.
   */
  function destroy() {
    renderRoot.innerHTML = '';
    renderRoot.style.transform = '';
  }

  return {
    update,
    getPlayheadX: () => playheadX,
    getHeight: () => height,
    destroy,
  };
}

/**
 * Compute the playhead X position within the viewport.
 * @param viewportWidth - Width of the viewport.
 * @param layout - Scrolling layout metrics.
 * @param config - Renderer config.
 * @returns X coordinate for the playhead.
 */
function computePlayheadX(
  viewportWidth: number,
  layout: ScrollingLayout,
  config: ScrollingRendererOptions,
) {
  const safeWidth = Math.max(viewportWidth, 1);
  const desired = safeWidth * config.playheadOffsetRatio;
  const minX = layout.padding + 40;
  const maxX = Math.max(minX, safeWidth - layout.padding - 40);
  const clamped = Math.min(Math.max(desired, minX), maxX);
  return Math.min(Math.max(clamped, 0), safeWidth);
}
