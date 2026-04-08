import { Formatter, Renderer, Stave } from 'vexflow';
import type { Lesson } from '@/features/musicxml/lessonModel';

import { drawHairpins, collectHairpinSpans } from './hairpins';
import { getLessonLastBeat } from './lessonMetrics';
import {
  measureModifierWidth,
  rebalanceLines,
  splitMeasuresIntoLines,
} from './layout';
import { prepareMeasures } from './measurePrep';
import type { DynamicEntry, NoteEntry } from '../types';
import { applyContextToVoices } from './voiceContext';

/**
 * Render a lesson to a container using VexFlow.
 * @param lesson - Lesson data to render.
 * @param container - Target HTML container.
 */
export function renderLesson(lesson: Lesson, container: HTMLDivElement) {
  if (lesson.measures.length === 0) return;
  const width = container.clientWidth;
  if (width <= 0) return;
  const renderer = new Renderer(container, Renderer.Backends.SVG);
  const context = renderer.getContext();

  const [beats, beatUnit] = lesson.timeSignature;
  const keySignature = lesson.keySignature;
  const padding = 24;
  const usableWidth = Math.max(width - padding * 2, 0);
  const rightPadding = 20;
  const lineHeight = 150;
  const topPadding = 24;
  const bottomPadding = 24;

  const modifierWidths = {
    withHeader: measureModifierWidth(beats, beatUnit, true, true, keySignature),
    withoutHeader: measureModifierWidth(beats, beatUnit, false, false, null),
  };

  const prepared = prepareMeasures(lesson);

  const lines = rebalanceLines(
    splitMeasuresIntoLines(prepared, usableWidth, modifierWidths, rightPadding),
    usableWidth,
    modifierWidths,
    rightPadding,
  );

  const height = topPadding + lines.length * lineHeight + bottomPadding;
  renderer.resize(width, height);

  const lastBeat = getLessonLastBeat(lesson, beats);
  const hairpinSpans = collectHairpinSpans(lesson.measures, beats, lastBeat);

  lines.forEach((line, lineIndex) => {
    const totalNotesMin = line.reduce(
      (sum, item) => sum + item.minNoteWidth,
      0,
    );
    const totalModifiers =
      line.length === 0
        ? 0
        : modifierWidths.withHeader +
          (line.length - 1) * modifierWidths.withoutHeader +
          line.length * rightPadding;
    const extraSpace = Math.max(
      0,
      usableWidth - totalModifiers - totalNotesMin,
    );
    const extraPerMeasure = extraSpace / line.length;

    let x = padding;
    const y = topPadding + lineIndex * lineHeight;

    const lineNoteEntries: NoteEntry[] = [];
    const lineDynamicEntries: DynamicEntry[] = [];

    line.forEach((item, index) => {
      const modifierWidth =
        index === 0 ? modifierWidths.withHeader : modifierWidths.withoutHeader;
      const measureWidth =
        modifierWidth + rightPadding + item.minNoteWidth + extraPerMeasure;
      const stave = new Stave(x, y, measureWidth);
      if (index === 0) {
        stave.addClef('treble');
        if (keySignature) {
          stave.addKeySignature(keySignature);
        }
        stave.addTimeSignature(`${beats}/${beatUnit}`);
      }
      stave.setContext(context).draw();

      const formatter = new Formatter();
      const voices = [item.voice, ...item.dynamicsVoices];
      applyContextToVoices(context, voices);
      formatter.joinVoices(voices).formatToStave(voices, stave);
      voices.forEach((voice) => voice.draw(context, stave));

      lineNoteEntries.push(...item.noteEntries);
      lineDynamicEntries.push(...item.explicitEntries);
      x += measureWidth;
    });

    drawHairpins({
      context,
      noteEntries: lineNoteEntries,
      dynamicEntries: lineDynamicEntries,
      hairpinSpans,
    });
  });
}
