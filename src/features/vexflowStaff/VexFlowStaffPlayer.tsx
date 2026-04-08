import { PauseIcon, PlayIcon, RotateCcwIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import type { TransportPhase } from '@/features/transport/transportClock';

type VexFlowStaffPlayerProps = {
  beatNumber: number | null;
  countInRemaining: number | null;
  currentBeat: number;
  isRunning: boolean;
  onPlayPause: () => void | Promise<void>;
  onReset: () => void;
  phase: TransportPhase;
  totalBeats: number;
};

function VexFlowStaffPlayer({
  beatNumber,
  countInRemaining,
  currentBeat,
  isRunning,
  onPlayPause,
  onReset,
  phase,
  totalBeats,
}: VexFlowStaffPlayerProps) {
  const clampedBeat = Math.min(totalBeats, Math.max(0, currentBeat));
  const displayBeat = Number(clampedBeat.toFixed(1));
  const displayTotalBeats = Number(totalBeats.toFixed(1));
  const phaseLabel = phase.replace('-', ' ');

  return (
    <Card className="w-full">
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="flex items-center gap-3">
            <Button type="button" size="lg" onClick={onPlayPause}>
              {isRunning ? <PauseIcon /> : <PlayIcon />}
              {isRunning ? 'Pause' : 'Play'}
            </Button>
            <Button type="button" variant="outline" size="lg" onClick={onReset}>
              <RotateCcwIcon />
              Reset
            </Button>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="mt-1 text-sm font-medium capitalize text-foreground">
                  {phaseLabel}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="capitalize">
                  {phaseLabel}
                </Badge>
                {phase === 'count-in' &&
                typeof countInRemaining === 'number' ? (
                  <Badge variant="outline">Count-in {countInRemaining}</Badge>
                ) : null}
                {typeof beatNumber === 'number' ? (
                  <Badge variant="outline">Beat {beatNumber}</Badge>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <Slider
                aria-label="Lesson position"
                value={[clampedBeat]}
                max={Math.max(totalBeats, 1)}
                step={0.01}
                disabled
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Start</span>
                <span className="tabular-nums">
                  {displayBeat} / {displayTotalBeats} beats
                </span>
                <span>End</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default VexFlowStaffPlayer;
