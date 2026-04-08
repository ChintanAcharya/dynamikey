import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router';

import {
  defaultLesson,
  getLessonPath,
} from '@/features/musicxml/lessonCatalog';
import { AppLayout } from '@/pages/layout/AppLayout';
import { NoLessonsState } from '@/pages/state/NoLessonsState';

const InputPage = lazy(async () => {
  const module = await import('@/pages/input/InputPage');

  return { default: module.InputPage };
});

const LessonPage = lazy(async () => {
  const module = await import('@/pages/lesson/LessonPage');

  return { default: module.LessonPage };
});

/**
 * Render the application route tree.
 * @returns App element.
 */
function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DefaultLessonRedirect />} />
        <Route path="input" element={<InputPage />} />
        <Route path="lesson/:id" element={<LessonPage />} />
        <Route path="*" element={<DefaultLessonRedirect />} />
      </Route>
    </Routes>
  );
}

function DefaultLessonRedirect() {
  if (!defaultLesson) {
    return <NoLessonsState />;
  }

  return <Navigate to={getLessonPath(defaultLesson.id)} replace />;
}

export default App;
