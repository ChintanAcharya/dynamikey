import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useInputRuntime } from '@/features/input/InputRuntimeContext';

import { MockKeyboardActiveNotes } from './MockKeyboardActiveNotes';
import { MockKeyboardKeyMap } from './MockKeyboardKeyMap';
import { MockKeyboardVelocityControl } from './MockKeyboardVelocityControl';

export function MockKeyboardInputCard() {
  const { activeNotes, setVelocity, velocity } = useInputRuntime();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mock keyboard input</CardTitle>
        <CardDescription>
          Simulate MIDI note events using your computer keyboard.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <MockKeyboardVelocityControl
          velocity={velocity}
          onVelocityChange={setVelocity}
        />
        <MockKeyboardKeyMap />
        <MockKeyboardActiveNotes activeNotes={activeNotes} />
      </CardContent>
    </Card>
  );
}
