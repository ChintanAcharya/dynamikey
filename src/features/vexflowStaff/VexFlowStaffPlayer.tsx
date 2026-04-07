import { Button } from '@/components/ui/button';
import type { TransportPhase } from '@/features/transport/transportClock';

type VexFlowStaffPlayerProps = {
  beatNumber: number | null;
  countInRemaining: number | null;
  isRunning: boolean;
  onPlayPause: () => void | Promise<void>;
  onReset: () => void;
  onTempoChange: (value: number) => void;
  phase: TransportPhase;
  tempoBpm: number;
};

function VexFlowStaffPlayer({
  beatNumber,
  countInRemaining,
  isRunning,
  onPlayPause,
  onReset,
  onTempoChange,
  phase,
  tempoBpm,
}: VexFlowStaffPlayerProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-black/70">
      <Button type="button" onClick={onPlayPause}>
        {isRunning ? 'Pause' : 'Play'}
      </Button>
      <Button type="button" onClick={onReset}>
        Reset
      </Button>
      <div className="flex flex-1 flex-wrap items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-black/50">
          Tempo
        </span>
        <input
          type="range"
          min={40}
          max={160}
          step={1}
          value={tempoBpm}
          onChange={(event) => {
            const value = Number(event.target.value);
            if (!Number.isNaN(value)) {
              onTempoChange(value);
            }
          }}
          className="h-1 w-full max-w-[200px] accent-black"
        />
        <span className="text-xs font-semibold text-black tabular-nums">
          {tempoBpm} BPM
        </span>
      </div>
      <span className="rounded-full border border-black/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-black/50">
        {phase.replace('-', ' ')}
      </span>
      {phase === 'count-in' && typeof countInRemaining === 'number' && (
        <span className="rounded-full border border-black/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-black/50">
          Count-in: {countInRemaining}
        </span>
      )}
      {typeof beatNumber === 'number' && (
        <span className="rounded-full border border-black/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-black/50">
          Beat: {beatNumber}
        </span>
      )}
    </div>
  );
}

export default VexFlowStaffPlayer;
