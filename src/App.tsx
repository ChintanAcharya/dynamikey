import { useEffect, useMemo, useState } from 'react';
import { lessons } from './musicxml/lessonCatalog';
import { normalizeLesson, type Lesson } from './musicxml/normalizeLesson';
import { parseLessonFromXml, type ParsedLesson } from './musicxml/osmdParser';
import MockKeyboardInput from './input/MockKeyboardInput';
import VexFlowStaff from './rendering/VexFlowStaff';

/**
 * Render the main app layout and drive lesson selection/parsing state.
 * @returns App element.
 */
function App() {
  const [selectedLessonId, setSelectedLessonId] = useState(
    lessons[0]?.id ?? '',
  );
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    'idle',
  );
  const [error, setError] = useState<string | null>(null);
  const [parsedLesson, setParsedLesson] = useState<ParsedLesson | null>(null);
  const [normalizedLesson, setNormalizedLesson] = useState<Lesson | null>(null);

  const selectedLesson = useMemo(
    () => lessons.find((lesson) => lesson.id === selectedLessonId) ?? null,
    [selectedLessonId],
  );

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!selectedLesson) {
      setParsedLesson(null);
      setNormalizedLesson(null);
      return;
    }

    let isActive = true;
    setStatus('loading');
    setError(null);

    parseLessonFromXml(selectedLesson.xml)
      .then((result) => {
        if (!isActive) return;
        setParsedLesson(result);
        setNormalizedLesson(normalizeLesson(result, selectedLesson.id));
        setStatus('ready');
        console.log('Parsed lesson output', result);
      })
      .catch((err) => {
        if (!isActive) return;
        setError(
          err instanceof Error ? err.message : 'Failed to parse lesson.',
        );
        setStatus('error');
        setNormalizedLesson(null);
      });

    return () => {
      isActive = false;
    };
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [selectedLesson]);

  return (
    <div className="min-h-screen px-6 py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="rounded-3xl border border-black/10 bg-white/80 p-8 shadow-[0_30px_120px_rgba(15,15,15,0.1)] backdrop-blur">
          <span className="text-sm font-semibold uppercase tracking-[0.35em] text-black/50">
            MIDI Dynamics Trainer
          </span>
          <h1 className="mt-3 text-4xl font-semibold leading-tight text-black">
            Milestone 5: Real-time feedback
          </h1>
          <p className="mt-2 max-w-3xl text-base text-black/60">
            Trigger note events with your computer keyboard and see immediate
            HIT/MISS feedback. Timing and velocity thresholds control whether
            notes are marked green, yellow, or red.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
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
                    onClick={() => setSelectedLessonId(lesson.id)}
                    className={`rounded-2xl border px-4 py-3 text-left transition ${
                      isActive
                        ? 'border-black bg-black text-white shadow-[0_12px_40px_rgba(0,0,0,0.2)]'
                        : 'border-black/10 bg-white text-black hover:border-black/30'
                    }`}
                  >
                    <div className="text-sm font-semibold">{lesson.title}</div>
                    <div className="mt-1 text-xs text-black/50">
                      {lesson.path}
                    </div>
                  </button>
                );
              })}
              {lessons.length === 0 && (
                <div className="rounded-2xl border border-dashed border-black/20 px-4 py-6 text-sm text-black/50">
                  No lessons found. Add MusicXML files to the{' '}
                  <code>lessons</code> folder.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-black/10 bg-white/85 p-6 shadow-[0_20px_80px_rgba(15,15,15,0.08)]">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-black">
                  Parser Output
                </h2>
                <p className="text-sm text-black/60">
                  {selectedLesson?.title ?? 'Select a lesson'}{' '}
                  {status === 'loading' && '• Parsing...'}
                </p>
              </div>
              <span className="rounded-full border border-black/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-black/50">
                {status}
              </span>
            </div>

            {error && (
              <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {parsedLesson && (
              <>
                {normalizedLesson && (
                  <div className="mt-6">
                    <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-black/40">
                      VexFlow Preview
                    </div>
                    <div className="rounded-2xl border border-black/10 bg-white p-4">
                      <VexFlowStaff
                        key={normalizedLesson.id}
                        lesson={normalizedLesson}
                      />
                    </div>
                  </div>
                )}

                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-black/10 bg-white px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-black/40">
                      Time Signature
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-black">
                      {parsedLesson.timeSignature
                        ? parsedLesson.timeSignature.join(' / ')
                        : '—'}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-black/10 bg-white px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-black/40">
                      Tempo
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-black">
                      {parsedLesson.tempoBpm
                        ? `${parsedLesson.tempoBpm} BPM`
                        : '—'}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-black/10 bg-white px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-black/40">
                      Totals
                    </div>
                    <div className="mt-2 text-sm font-semibold text-black">
                      {parsedLesson.diagnostics.totalMeasures} measures
                    </div>
                    <div className="text-xs text-black/50">
                      {parsedLesson.diagnostics.totalNotes} notes •{' '}
                      {parsedLesson.diagnostics.totalDynamics} dynamics
                    </div>
                  </div>
                </div>

              </>
            )}

          </section>
        </div>

        <section className="rounded-3xl border border-black/10 bg-white/85 p-6 shadow-[0_20px_80px_rgba(15,15,15,0.08)]">
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-black/40">
            Mock keyboard input
          </div>
          <MockKeyboardInput />
        </section>
      </div>
    </div>
  );
}

export default App;
