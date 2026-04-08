import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

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
    <Card>
      <CardHeader>
        <CardTitle>Lesson Details</CardTitle>
        <CardDescription>
          Reference values for the current target note.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Current note
          </div>
          <div className="mt-2 text-2xl font-semibold text-foreground">
            {currentNoteLabel}
          </div>
          <div className="text-xs text-muted-foreground">
            Target velocity {targetVelocity ?? '—'}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Windows
          </div>
          <div className="mt-2 text-sm text-foreground">
            Timing ±{Math.round(timingWindowMs)} ms
          </div>
          <div className="text-sm text-foreground">
            Velocity ±{velocityTolerance}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default VexFlowStaffInfo;
