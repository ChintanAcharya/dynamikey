import { useMemo } from 'react';
import { PauseIcon, PlayIcon, RotateCcwIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import type { TransportPhase } from '@/features/transport/transportClock';

type VexFlowStaffPlayerProps = {
  currentBeat: number;
  isRunning: boolean;
  onPlayPause: () => void | Promise<void>;
  onReset: () => void;
  phase: TransportPhase;
  totalBeats: number;
};

function VexFlowStaffPlayer({
  currentBeat,
  isRunning,
  onPlayPause,
  onReset,
  phase,
  totalBeats,
}: VexFlowStaffPlayerProps) {
  const clampedBeat = Math.min(totalBeats, Math.max(0, currentBeat));
  const displayBeat = Math.trunc(clampedBeat);
  const displayTotalBeats = Math.trunc(totalBeats);
  const phaseLabel = phase.replace('-', ' ');

  const sliderValue = useMemo(() => {
    return [displayBeat];
  }, [displayBeat]);

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

          <div className="flex min-w-0 flex-1 gap-4 items-center">
            <div className="space-y-2 flex-1">
              <Slider
                aria-label="Lesson position"
                value={sliderValue}
                max={Math.max(totalBeats, 1)}
                step={0.01}
                disabled
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="tabular-nums">
                {displayBeat} / {displayTotalBeats} beats
              </span>
            </div>
            <div className="flex gap-3 items-center justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="capitalize">
                  {phaseLabel}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default VexFlowStaffPlayer;
