type FeedbackIndicator = 'ready' | 'hit' | 'warn' | 'miss';

type VexFlowStaffFeedbackProps = {
  flashKey: number;
  indicator: FeedbackIndicator;
  timing: string;
  velocity: string;
};

function VexFlowStaffFeedback({
  flashKey,
  indicator,
  timing,
  velocity,
}: VexFlowStaffFeedbackProps) {
  const feedbackLabel =
    indicator === 'miss' ? 'MISS' : indicator === 'ready' ? 'READY' : 'HIT';
  const feedbackTone =
    indicator === 'miss'
      ? 'border-red-500/30 bg-red-500/10 text-red-700'
      : indicator === 'warn'
        ? 'border-amber-500/40 bg-amber-500/15 text-amber-700'
        : indicator === 'hit'
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
          : 'border-black/10 bg-black/5 text-black/60';
  const feedbackPillTone =
    indicator === 'miss'
      ? 'border border-red-500/40 bg-red-500/10 text-red-700'
      : indicator === 'warn'
        ? 'border border-amber-500/50 bg-amber-500/15 text-amber-800'
        : indicator === 'hit'
          ? 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-700'
          : 'border border-black/10 bg-white/70 text-black/70';

  return (
    <div className={`rounded-2xl border p-4 ${feedbackTone}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-[0.2em]">
          Feedback
        </div>
        <div
          className={`flash-indicator ${
            flashKey % 2 === 0 ? '' : 'flash-indicator--on'
          }`}
        />
      </div>
      <div className="mt-2 text-4xl font-semibold">{feedbackLabel}</div>
      <div className="mt-4 grid grid-cols-2 gap-6">
        <div className="min-w-0">
          <div className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-black/50">
            Velocity
          </div>
          <div className="mt-1 min-h-[2.5rem] flex items-center">
            <span
              className={`inline-flex max-w-full items-center rounded-full px-3 py-1 text-xs font-semibold truncate ${feedbackPillTone}`}
            >
              {velocity}
            </span>
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-black/50">
            Timing
          </div>
          <div className="mt-1 min-h-[2.5rem] flex items-center">
            <span
              className={`inline-flex max-w-full items-center rounded-full px-3 py-1 text-xs font-semibold truncate ${feedbackPillTone}`}
            >
              {timing}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VexFlowStaffFeedback;
