import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Field, FieldContent, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
          <Field>
            <FieldLabel>Input device</FieldLabel>
            <FieldContent>
              <Select
                value={selectedInputId || undefined}
                onValueChange={setSelectedInputId}
                disabled={inputs.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No MIDI inputs found" />
                </SelectTrigger>
                <SelectContent>
                  {inputs.map((input) => (
                    <SelectItem key={input.id} value={input.id}>
                      {input.name ?? 'Unknown device'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldContent>
          </Field>
        )}
      </CardContent>
    </Card>
  );
}

export default WebMidiInput;
