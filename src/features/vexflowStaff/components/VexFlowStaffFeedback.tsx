import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
          : 'border-border bg-card text-foreground';

  const feedbackPillTone =
    indicator === 'miss'
      ? 'border-red-500/40 bg-red-500/10 text-red-700'
      : indicator === 'warn'
        ? 'border-amber-500/50 bg-amber-500/15 text-amber-800'
        : indicator === 'hit'
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700'
          : 'border-border bg-muted text-muted-foreground';

  return (
    <Card className={feedbackTone}>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Feedback</CardTitle>
          <div className="flex items-center gap-3">
            <Badge variant={indicator === 'ready' ? 'outline' : 'secondary'}>
              {feedbackLabel}
            </Badge>
            <div
              className={`flash-indicator ${
                flashKey % 2 === 0 ? '' : 'flash-indicator--on'
              }`}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="min-w-0">
          <div className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Velocity
          </div>
          <div className="mt-2">
            <Badge variant="outline" className={feedbackPillTone}>
              {velocity}
            </Badge>
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Timing
          </div>
          <div className="mt-2">
            <Badge variant="outline" className={feedbackPillTone}>
              {timing}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default VexFlowStaffFeedback;
