import { use, useMemo } from 'react';

import {
  loadLessonXml,
  type LessonSource,
} from '@/features/musicxml/lessonCatalog';
import { normalizeLesson } from '@/features/musicxml/normalizeLesson';
import { parseLessonFromXml } from '@/features/musicxml/osmdParser';
import VexFlowStaff from '@/features/vexflowStaff/VexFlowStaff';

type LessonRendererProps = {
  selectedLesson: LessonSource;
};

export function LessonRenderer({ selectedLesson }: LessonRendererProps) {
  const parseLessonPromise = useMemo(
    () => loadLessonXml(selectedLesson).then((xml) => parseLessonFromXml(xml)),
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
      {parsedLesson && normalizedLesson ? (
        <VexFlowStaff key={normalizedLesson.id} lesson={normalizedLesson} />
      ) : null}
    </section>
  );
}
