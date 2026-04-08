import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useMockKeyboardInput } from '@/features/input/hooks/useMockKeyboardInput';
import { useWebMidiAccess } from '@/features/input/hooks/useWebMidiAccess';
import type { MidiStatus } from '@/features/input/types';

type InputRuntimeValue = {
  activeNotes: number[];
  error: string | null;
  inputs: MIDIInput[];
  requestMidiAccess: () => Promise<void>;
  selectedInputId: string;
  setSelectedInputId: (value: string) => void;
  status: MidiStatus;
  statusLabel: string;
  velocity: number;
  setVelocity: (value: number) => void;
};

const InputRuntimeContext = createContext<InputRuntimeValue | null>(null);

export function InputRuntimeProvider({ children }: { children: ReactNode }) {
  const [velocity, setVelocity] = useState(96);
  const {
    error,
    inputs,
    requestMidiAccess,
    selectedInputId,
    setSelectedInputId,
    status,
  } = useWebMidiAccess();
  const { activeNotes } = useMockKeyboardInput(velocity);

  const statusLabel = useMemo(() => {
    switch (status) {
      case 'requesting':
        return 'Requesting access';
      case 'ready':
        return inputs.length > 0 ? 'Connected' : 'No devices';
      case 'error':
        return 'Error';
      case 'unsupported':
        return 'Unsupported';
      default:
        return 'Idle';
    }
  }, [inputs.length, status]);

  const value = useMemo<InputRuntimeValue>(
    () => ({
      activeNotes,
      error,
      inputs,
      requestMidiAccess,
      selectedInputId,
      setSelectedInputId,
      status,
      statusLabel,
      velocity,
      setVelocity,
    }),
    [
      activeNotes,
      error,
      inputs,
      requestMidiAccess,
      selectedInputId,
      setSelectedInputId,
      status,
      statusLabel,
      velocity,
    ],
  );

  return (
    <InputRuntimeContext.Provider value={value}>
      {children}
    </InputRuntimeContext.Provider>
  );
}

export function useInputRuntime() {
  const context = useContext(InputRuntimeContext);

  if (!context) {
    throw new Error(
      'useInputRuntime must be used within InputRuntimeProvider.',
    );
  }

  return context;
}
