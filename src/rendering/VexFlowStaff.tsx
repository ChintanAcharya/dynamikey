import { useEffect, useRef } from 'react';
import type { Lesson } from '../musicxml/normalizeLesson';
import { renderLesson } from './vexflowStaff/renderLesson';

type VexFlowStaffProps = {
  lesson: Lesson;
};

/**
 * Render a VexFlow staff for the provided lesson.
 * @param props - Component props.
 * @returns React element.
 */
function VexFlowStaff({ lesson }: VexFlowStaffProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    /**
     * Clear and redraw the staff for the current container size.
     */
    function draw() {
      const target = containerRef.current;
      if (!target) return;
      target.innerHTML = '';
      renderLesson(lesson, target);
    }
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(container);

    return () => observer.disconnect();
  }, [lesson]);

  return <div ref={containerRef} className="w-full" />;
}

export default VexFlowStaff;
