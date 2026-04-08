import { MockKeyboardInputCard } from '@/features/input/components/MockKeyboardInputCard';
import { RecentInputEventsCard } from '@/features/input/components/RecentInputEventsCard';
import { WebMidiInputCard } from '@/features/input/components/WebMidiInputCard';

export function InputDashboard() {
  return (
    <section className="flex flex-col gap-4">
      <WebMidiInputCard />
      <MockKeyboardInputCard />
      <RecentInputEventsCard />
    </section>
  );
}
