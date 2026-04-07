import { use, useMemo } from 'react';
import type { LessonSource } from '../features/musicxml/lessonCatalog';
import { normalizeLesson } from '../features/musicxml/normalizeLesson';
import { parseLessonFromXml } from '../features/musicxml/osmdParser';
import VexFlowStaff from '../features/vexflowStaff/VexFlowStaff';

type MainStaffRendererProps = {
  selectedLesson: LessonSource | null;
};

/**
 * Render parsed lesson details and the VexFlow preview.
 * @param props - Staff renderer props.
 * @returns Parser output section.
 */
function MainStaffRenderer({ selectedLesson }: MainStaffRendererProps) {
  const parseLessonPromise = useMemo(() => {
    if (!selectedLesson) {
      return Promise.resolve(null);
    }

    return parseLessonFromXml(selectedLesson.xml);
  }, [selectedLesson]);

  const parsedLesson = use(parseLessonPromise);

  const normalizedLesson = useMemo(() => {
    if (!parsedLesson || !selectedLesson) {
      return null;
    }

    return normalizeLesson(parsedLesson, selectedLesson.id);
  }, [parsedLesson, selectedLesson]);

  return (
    <section className="rounded-3xl border border-black/10 bg-white/85 p-6 shadow-[0_20px_80px_rgba(15,15,15,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-black">Parser Output</h2>
          <p className="text-sm text-black/60">
            {selectedLesson?.title ?? 'Select a lesson'}{' '}
          </p>
        </div>
      </div>

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
                {parsedLesson.tempoBpm ? `${parsedLesson.tempoBpm} BPM` : '—'}
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
  );
}

export default MainStaffRenderer;
