import { Slider } from '@/components/ui/slider';

type MockKeyboardVelocityControlProps = {
  velocity: number;
  onVelocityChange: (value: number) => void;
};

const MIN_VELOCITY = 1;
const MAX_VELOCITY = 127;

export function MockKeyboardVelocityControl({
  velocity,
  onVelocityChange,
}: MockKeyboardVelocityControlProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-black/40">
        Velocity
      </span>
      <Slider
        aria-label="Mock keyboard velocity"
        className="w-36"
        min={MIN_VELOCITY}
        max={MAX_VELOCITY}
        step={1}
        value={[velocity]}
        onValueChange={(values) => {
          const nextVelocity = values[0];
          if (typeof nextVelocity === 'number') {
            onVelocityChange(nextVelocity);
          }
        }}
      />
      <span className="text-xs font-semibold text-black tabular-nums">
        {velocity}
      </span>
    </div>
  );
}
