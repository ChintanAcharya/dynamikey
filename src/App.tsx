import { Suspense, useMemo, useState } from 'react';
import InputSection from './components/InputSection';
import LessonList from './components/LessonList';
import MainStaffRenderer from './components/MainStaffRenderer';
import { lessons } from './musicxml/lessonCatalog';

/**
 * Render the main app layout and drive lesson selection/parsing state.
 * @returns App element.
 */
function App() {
  const [selectedLessonId, setSelectedLessonId] = useState(
    lessons[0]?.id ?? '',
  );

  const selectedLesson = useMemo(
    () => lessons.find((lesson) => lesson.id === selectedLessonId) ?? null,
    [selectedLessonId],
  );

  return (
    <div className="min-h-screen px-6 py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="rounded-3xl border border-black/10 bg-white/80 p-8 shadow-[0_30px_120px_rgba(15,15,15,0.1)] backdrop-blur">
          <h1 className="mt-3 text-4xl font-semibold leading-tight text-black">
            MIDI Dynamics Trainer
          </h1>
        </header>

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <LessonList
            lessons={lessons}
            selectedLessonId={selectedLessonId}
            onSelectLesson={setSelectedLessonId}
          />
          <Suspense>
            <MainStaffRenderer selectedLesson={selectedLesson} />
          </Suspense>
        </div>

        <InputSection />
      </div>
    </div>
  );
}

export default App;
