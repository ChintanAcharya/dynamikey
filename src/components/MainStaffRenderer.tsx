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
    <section>
      {parsedLesson && (
        <>
          {normalizedLesson && (
            <VexFlowStaff key={normalizedLesson.id} lesson={normalizedLesson} />
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
