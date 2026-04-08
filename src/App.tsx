import { Navigate, Route, Routes } from 'react-router';

import {
  defaultLesson,
  getLessonPath,
} from '@/features/musicxml/lessonCatalog';
import { InputPage } from '@/pages/input/InputPage';
import { AppLayout } from '@/pages/layout/AppLayout';
import { LessonPage } from '@/pages/lesson/LessonPage';
import { NoLessonsState } from '@/pages/state/NoLessonsState';

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
