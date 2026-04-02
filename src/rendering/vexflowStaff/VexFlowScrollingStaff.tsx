import { useEffect, useRef, useState } from 'react';
import type { Lesson } from '../../musicxml/normalizeLesson';
import {
  createScrollingLessonRenderer,
  type NoteFeedbackMap,
  type ScrollingRenderer,
} from './scrollingRenderer';

type VexFlowScrollingStaffProps = {
  currentBeat: number;
  feedbackRevision: number;
  lesson: Lesson;
  noteStatuses: NoteFeedbackMap;
};

type RenderState = {
  currentBeat: number;
  feedbackRevision: number;
  noteStatuses: NoteFeedbackMap;
};

function VexFlowScrollingStaff({
  currentBeat,
  feedbackRevision,
  lesson,
  noteStatuses,
}: VexFlowScrollingStaffProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const renderRootRef = useRef<HTMLDivElement | null>(null);
  const playheadRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<ScrollingRenderer | null>(null);
  const latestRenderStateRef = useRef<RenderState>({
    currentBeat,
    feedbackRevision,
    noteStatuses,
  });
  const [staffHeight, setStaffHeight] = useState<number | null>(null);

  useEffect(() => {
    latestRenderStateRef.current = {
      currentBeat,
      feedbackRevision,
      noteStatuses,
    };
    rendererRef.current?.update(currentBeat, noteStatuses, feedbackRevision);
  }, [currentBeat, feedbackRevision, noteStatuses]);

  useEffect(() => {
    const viewport = viewportRef.current;
    const renderRoot = renderRootRef.current;
    if (!viewport || !renderRoot) return;

    let activeRenderer: ScrollingRenderer | null = null;

    const rebuild = () => {
      const width = viewport.clientWidth;
      if (width <= 0 || lesson.measures.length === 0) return;

      activeRenderer?.destroy();
      activeRenderer = createScrollingLessonRenderer(lesson, renderRoot, width);
      rendererRef.current = activeRenderer;
      setStaffHeight(activeRenderer.getHeight());

      const playhead = playheadRef.current;
      if (playhead) {
        playhead.style.left = `${activeRenderer.getPlayheadX()}px`;
      }

      const latestRenderState = latestRenderStateRef.current;
      activeRenderer.update(
        latestRenderState.currentBeat,
        latestRenderState.noteStatuses,
        latestRenderState.feedbackRevision,
      );
    };

    rebuild();
    const observer = new ResizeObserver(rebuild);
    observer.observe(viewport);

    return () => {
      observer.disconnect();
      activeRenderer?.destroy();
      if (rendererRef.current === activeRenderer) {
        rendererRef.current = null;
      }
    };
  }, [lesson]);

  return (
    <div
      ref={viewportRef}
      className="relative w-full overflow-hidden rounded-2xl border border-black/10 bg-white"
      style={staffHeight ? { height: staffHeight } : undefined}
    >
      <div ref={renderRootRef} className="absolute left-0 top-0" />
      <div
        ref={playheadRef}
        className="pointer-events-none absolute top-0 h-full w-px bg-red-500/80"
      />
    </div>
  );
}

export default VexFlowScrollingStaff;
