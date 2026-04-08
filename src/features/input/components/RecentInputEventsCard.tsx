import { useEffect, useState } from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { subscribeInput } from '@/features/input/lib/inputBus';
import { formatMidiNote } from '@/features/input/lib/noteUtils';
import type { MidiInputSource, MidiNoteEvent } from '@/features/input/types';

const MAX_RECENT_EVENTS = 6;

const SOURCE_LABELS: Record<MidiInputSource, string> = {
  mock: 'Keyboard',
  webmidi: 'MIDI device',
};

export function RecentInputEventsCard() {
  const [recentEvents, setRecentEvents] = useState<MidiNoteEvent[]>([]);

  useEffect(() => {
    return subscribeInput((event) => {
      setRecentEvents((previous) =>
        [event, ...previous].slice(0, MAX_RECENT_EVENTS),
      );
    });
  }, []);

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Recent events</CardTitle>
        <CardDescription>
          Latest note activity from the computer keyboard or connected MIDI
          devices.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2">
          {recentEvents.length === 0 ? (
            <span className="text-xs text-black/50">
              Play a note on any input to see events.
            </span>
          ) : null}
          {recentEvents.map((event) => (
            <div
              key={`${event.timestamp}-${event.source}-${event.type}-${event.midiNote}`}
              className="flex items-start justify-between gap-3 rounded-xl border border-black/10 bg-black/5 px-3 py-2 text-xs text-black/70"
            >
              <div>
                <div className="font-semibold text-black">
                  {event.type.toUpperCase()} {formatMidiNote(event.midiNote)}
                </div>
                <div>Velocity {event.velocity}</div>
              </div>
              <span className="rounded-full border border-black/10 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-black/60">
                {SOURCE_LABELS[event.source]}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
