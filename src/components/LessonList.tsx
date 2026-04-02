import type { LessonSource } from '../musicxml/lessonCatalog';

type LessonListProps = {
  lessons: LessonSource[];
  selectedLessonId: string;
  onSelectLesson: (lessonId: string) => void;
};

/**
 * Render the list of available lessons and highlight the active selection.
 * @param props - Lesson list props.
 * @returns Lesson picker section.
 */
function LessonList({
  lessons,
  selectedLessonId,
  onSelectLesson,
}: LessonListProps) {
  return (
    <section className="rounded-3xl border border-black/10 bg-white/85 p-6 shadow-[0_20px_80px_rgba(15,15,15,0.08)]">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-black">Lessons</h2>
        <span className="text-xs uppercase tracking-[0.2em] text-black/40">
          {lessons.length} found
        </span>
      </div>
      <div className="mt-4 flex flex-col gap-3">
        {lessons.map((lesson) => {
          const isActive = lesson.id === selectedLessonId;
          return (
            <button
              key={lesson.id}
              onClick={() => onSelectLesson(lesson.id)}
              className={`rounded-2xl border px-4 py-3 text-left transition ${
                isActive
                  ? 'border-black bg-black text-white shadow-[0_12px_40px_rgba(0,0,0,0.2)]'
                  : 'border-black/10 bg-white text-black hover:border-black/30'
              }`}
            >
              <div className="text-sm font-semibold">{lesson.title}</div>
              <div className="mt-1 text-xs text-black/50">{lesson.path}</div>
            </button>
          );
        })}
        {lessons.length === 0 && (
          <div className="rounded-2xl border border-dashed border-black/20 px-4 py-6 text-sm text-black/50">
            No lessons found. Add MusicXML files to the <code>lessons</code>{' '}
            folder.
          </div>
        )}
      </div>
    </section>
  );
}

export default LessonList;
