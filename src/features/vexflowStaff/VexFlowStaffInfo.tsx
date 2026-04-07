type VexFlowStaffInfoProps = {
  currentNoteLabel: string;
  targetVelocity: number | null;
  timingWindowMs: number;
  velocityTolerance: number;
};

function VexFlowStaffInfo({
  currentNoteLabel,
  targetVelocity,
  timingWindowMs,
  velocityTolerance,
}: VexFlowStaffInfoProps) {
  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-black/40">
          Current note
        </div>
        <div className="mt-2 text-2xl font-semibold text-black">
          {currentNoteLabel}
        </div>
        <div className="text-xs text-black/50">
          Target velocity {targetVelocity ?? '—'}
        </div>
      </div>
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-black/40">
          Windows
        </div>
        <div className="mt-2 text-sm text-black/70">
          Timing ±{Math.round(timingWindowMs)} ms
        </div>
        <div className="text-sm text-black/70">
          Velocity ±{velocityTolerance}
        </div>
      </div>
    </div>
  );
}

export default VexFlowStaffInfo;
