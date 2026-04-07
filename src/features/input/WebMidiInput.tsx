import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import { useInputRuntime } from './InputRuntimeContext';
import { Badge } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Render controls for connecting and selecting Web MIDI devices.
 * @returns React element.
 */
function WebMidiInput() {
  const {
    error,
    inputs,
    requestMidiAccess,
    selectedInputId,
    setSelectedInputId,
    status,
    statusLabel,
  } = useInputRuntime();

  return (
    <Card>
      <CardHeader>
        <CardTitle>MIDI devices</CardTitle>
        <CardDescription>
          Connect a hardware controller to drive note events.
        </CardDescription>
        <CardAction>
          {/* TODO: fix this */}
          <Badge>{statusLabel}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        {status !== 'ready' && (
          <Button
            type="button"
            onClick={() => {
              void requestMidiAccess();
            }}
          >
            Enable MIDI
          </Button>
        )}

        {error && (
          <div className="mt-3 rounded-2xl border border-red-500/30 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {status === 'ready' && (
          <div className="mt-4 grid gap-3">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-black/40">
              Input device
            </label>
            <select
              value={selectedInputId}
              onChange={(event) => setSelectedInputId(event.target.value)}
              className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black"
            >
              {inputs.length === 0 && (
                <option value="">No MIDI inputs found</option>
              )}
              {inputs.map((input) => (
                <option key={input.id} value={input.id}>
                  {input.name ?? 'Unknown device'}
                </option>
              ))}
            </select>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default WebMidiInput;
