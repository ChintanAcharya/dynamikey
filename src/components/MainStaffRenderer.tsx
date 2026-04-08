import { use, useMemo } from 'react';
import type { LessonSource } from '../features/musicxml/lessonCatalog';
import { normalizeLesson } from '../features/musicxml/normalizeLesson';
import { parseLessonFromXml } from '../features/musicxml/osmdParser';
import VexFlowStaff from '../features/vexflowStaff/VexFlowStaff';

type MainStaffRendererProps = {
  selectedLesson: LessonSource;
};

/**
 * Render parsed lesson details and the VexFlow preview.
 * @param props - Staff renderer props.
 * @returns Parser output section.
 */
function MainStaffRenderer({ selectedLesson }: MainStaffRendererProps) {
  const parseLessonPromise = useMemo(
    () => parseLessonFromXml(selectedLesson.xml),
    [selectedLesson],
  );

  const parsedLesson = use(parseLessonPromise);

  const normalizedLesson = useMemo(() => {
    if (!parsedLesson) {
      return null;
    }

    return normalizeLesson(parsedLesson, selectedLesson.id);
  }, [parsedLesson, selectedLesson]);

  return (
    <section className="flex h-full min-h-0 flex-col">
      {parsedLesson && (
        <>
          {normalizedLesson ? (
            <VexFlowStaff key={normalizedLesson.id} lesson={normalizedLesson} />
          ) : null}
        </>
      )}
    </section>
  );
}

export default MainStaffRenderer;
