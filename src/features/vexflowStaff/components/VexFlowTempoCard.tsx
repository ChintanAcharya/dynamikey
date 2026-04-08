import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';

type VexFlowTempoCardProps = {
  tempoBpm: number;
  onTempoChange: (value: number) => void;
};

export function VexFlowTempoCard({
  tempoBpm,
  onTempoChange,
}: VexFlowTempoCardProps) {
  return (
    <Card className="xl:col-span-1">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Tempo</CardTitle>
            <CardDescription>
              Adjust playback speed for the lesson.
            </CardDescription>
          </div>
          <Badge variant="outline" className="tabular-nums">
            {tempoBpm} BPM
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Slider
          aria-label="Tempo"
          value={[tempoBpm]}
          min={40}
          max={160}
          step={1}
          onValueChange={(values) => {
            const value = values[0];
            if (typeof value === 'number') {
              onTempoChange(value);
            }
          }}
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>40 BPM</span>
          <span>160 BPM</span>
        </div>
      </CardContent>
    </Card>
  );
}
