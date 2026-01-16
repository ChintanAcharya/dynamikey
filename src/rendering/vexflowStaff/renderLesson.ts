import { Formatter, Renderer, Stave, Voice } from 'vexflow';
import type { Lesson } from '../../musicxml/normalizeLesson';
import { DYNAMICS_LINE } from './constants';
import { buildDynamicsVoice, isExplicitDynamic } from './dynamics';
import { drawHairpins, collectHairpinSpans } from './hairpins';
import { measureModifierWidth, rebalanceLines, splitMeasuresIntoLines } from './layout';
import { buildMeasureNotes } from './notes';
import type { DynamicEntry, NoteEntry, VexFlowContext } from './types';

/**
 * Attach a rendering context to all tickables in the provided voices.
 * @param context - VexFlow rendering context.
 * @param voices - VexFlow voices to update.
 */
function applyContextToVoices(context: VexFlowContext, voices: Voice[]) {
  voices.forEach((voice) => {
    voice.getTickables().forEach((tickable) => {
      if (
        typeof (tickable as { setContext?: (ctx: VexFlowContext) => void })
          .setContext === 'function'
      ) {
        (tickable as { setContext: (ctx: VexFlowContext) => void }).setContext(
          context,
        );
      }
    });
  });
}

/**
 * Determine the last absolute beat in the lesson timeline.
 * @param lesson - Lesson data.
 * @param beatsPerMeasure - Numerator of the time signature.
 * @returns Absolute beat at the lesson end.
 */
function getLessonLastBeat(lesson: Lesson, beatsPerMeasure: number) {
  const lastTimelineBeat =
    lesson.timeline.length > 0
      ? lesson.timeline[lesson.timeline.length - 1].absoluteBeat
      : null;
  if (typeof lastTimelineBeat === 'number') return lastTimelineBeat;

  const lastMeasure = lesson.measures[lesson.measures.length - 1];
  if (!lastMeasure) return 0;
  return (lastMeasure.index + 1) * beatsPerMeasure;
}

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
  const padding = 24;
  const usableWidth = Math.max(width - padding * 2, 0);
  const rightPadding = 20;
  const lineHeight = 150;
  const topPadding = 24;
  const bottomPadding = 24;

  const modifierWidths = {
    withHeader: measureModifierWidth(beats, beatUnit, true, true),
    withoutHeader: measureModifierWidth(beats, beatUnit, false, false),
  };

  const prepared = lesson.measures.map((measure) => {
    const { tickables, noteEntries } = buildMeasureNotes(measure, beatUnit);
    const voice = new Voice({ num_beats: beats, beat_value: beatUnit });
    voice.addTickables(tickables);
    const explicitDynamics = buildDynamicsVoice(
      measure,
      beats,
      beatUnit,
      DYNAMICS_LINE,
      isExplicitDynamic,
      (type) => type,
    );
    const dynamicsVoices = explicitDynamics ? [explicitDynamics.voice] : [];
    applyContextToVoices(context, [voice, ...dynamicsVoices]);

    const formatter = new Formatter();
    const voices = [voice, ...dynamicsVoices];
    formatter.joinVoices(voices);
    const minNoteWidth = formatter.preCalculateMinTotalWidth(voices);

    return {
      voice,
      dynamicsVoices,
      minNoteWidth,
      noteEntries,
      explicitEntries: explicitDynamics?.entries ?? [],
    };
  });

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
        stave.addClef('treble').addTimeSignature(`${beats}/${beatUnit}`);
      }
      stave.setContext(context).draw();

      const formatter = new Formatter();
      const voices = [item.voice, ...item.dynamicsVoices];
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
