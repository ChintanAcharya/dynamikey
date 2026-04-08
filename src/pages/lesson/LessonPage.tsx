import { Suspense } from 'react';
import { Navigate, useParams } from 'react-router';

import {
  defaultLesson,
  findLessonById,
  getLessonPath,
} from '@/features/musicxml/lessonCatalog';
import { NoLessonsState } from '@/pages/state/NoLessonsState';

import { LessonRenderer } from './components/LessonRenderer';

export function LessonPage() {
  const { id } = useParams();
  const selectedLesson = findLessonById(id);

  if (!selectedLesson) {
    if (!defaultLesson) {
      return <NoLessonsState />;
    }

    return <Navigate to={getLessonPath(defaultLesson.id)} replace />;
  }

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <div className="flex h-full min-h-0 flex-col">
        <LessonRenderer selectedLesson={selectedLesson} />
      </div>
    </Suspense>
  );
}
