import { use, useMemo } from 'react';

import {
  loadLessonXml,
  type LessonSource,
} from '@/features/musicxml/lessonCatalog';
import { parseLessonFromXml } from '@/features/musicxml/musicXmlParser';
import VexFlowStaff from '@/features/vexflowStaff/VexFlowStaff';

type LessonRendererProps = {
  selectedLesson: LessonSource;
};

export function LessonRenderer({ selectedLesson }: LessonRendererProps) {
  const lessonPromise = useMemo(
    () =>
      loadLessonXml(selectedLesson).then((xml) =>
        parseLessonFromXml(xml, selectedLesson.id),
      ),
    [selectedLesson],
  );

  const lesson = use(lessonPromise);

  return (
    <section className="flex h-full min-h-0 flex-col">
      {lesson ? <VexFlowStaff key={lesson.id} lesson={lesson} /> : null}
    </section>
  );
}
