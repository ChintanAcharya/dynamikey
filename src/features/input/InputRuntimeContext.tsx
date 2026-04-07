import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { emitInput } from '@/features/input/inputBus';
import type { MidiNoteEvent } from '@/features/input/midiEvents';

export type MidiStatus =
  | 'idle'
  | 'requesting'
  | 'ready'
  | 'error'
  | 'unsupported';

type NavigatorWithMidi = Navigator & {
  requestMIDIAccess?: (options?: { sysex?: boolean }) => Promise<MIDIAccess>;
};

type KeyTone = 'white' | 'black';

type KeyMapping = {
  key: string;
  midiNote: number;
  label: string;
  tone: KeyTone;
};

type InputRuntimeValue = {
  activeNotes: number[];
  error: string | null;
  inputs: MIDIInput[];
  recentMockEvents: MidiNoteEvent[];
  requestMidiAccess: () => Promise<void>;
  selectedInputId: string;
  setSelectedInputId: (value: string) => void;
  status: MidiStatus;
  statusLabel: string;
  velocity: number;
  setVelocity: (value: number) => void;
};

const KEY_LAYOUT: KeyMapping[] = [
  { key: 'a', midiNote: 60, label: 'A', tone: 'white' },
  { key: 'w', midiNote: 61, label: 'W', tone: 'black' },
  { key: 's', midiNote: 62, label: 'S', tone: 'white' },
  { key: 'e', midiNote: 63, label: 'E', tone: 'black' },
  { key: 'd', midiNote: 64, label: 'D', tone: 'white' },
  { key: 'f', midiNote: 65, label: 'F', tone: 'white' },
  { key: 't', midiNote: 66, label: 'T', tone: 'black' },
  { key: 'g', midiNote: 67, label: 'G', tone: 'white' },
  { key: 'y', midiNote: 68, label: 'Y', tone: 'black' },
  { key: 'h', midiNote: 69, label: 'H', tone: 'white' },
  { key: 'u', midiNote: 70, label: 'U', tone: 'black' },
  { key: 'j', midiNote: 71, label: 'J', tone: 'white' },
  { key: 'k', midiNote: 72, label: 'K', tone: 'white' },
];

const KEY_TO_MIDI = KEY_LAYOUT.reduce<Record<string, number>>((acc, entry) => {
  acc[entry.key] = entry.midiNote;
  return acc;
}, {});

const InputRuntimeContext = createContext<InputRuntimeValue | null>(null);

const getEventTimestamp = (event: Event) => {
  if (Number.isFinite(event.timeStamp) && event.timeStamp > 0) {
    return event.timeStamp;
  }
  return performance.now();
};

const shouldIgnoreKeyEvent = (event: KeyboardEvent) => {
  if (event.altKey || event.ctrlKey || event.metaKey) return true;
  const target = event.target;
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  );
};

export function InputRuntimeProvider({ children }: { children: ReactNode }) {
  const accessRef = useRef<MIDIAccess | null>(null);
  const activeInputRef = useRef<MIDIInput | null>(null);
  const activeKeysRef = useRef<Set<string>>(new Set());
  const [status, setStatus] = useState<MidiStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [inputs, setInputs] = useState<MIDIInput[]>([]);
  const [selectedInputId, setSelectedInputId] = useState('');
  const [velocity, setVelocity] = useState(96);
  const [activeNotes, setActiveNotes] = useState<number[]>([]);
  const [recentMockEvents, setRecentMockEvents] = useState<MidiNoteEvent[]>([]);

  const refreshInputs = useCallback((access: MIDIAccess) => {
    const nextInputs = Array.from(access.inputs.values());
    setInputs(nextInputs);
    setSelectedInputId((current) => {
      if (nextInputs.length === 0) return '';
      if (current && nextInputs.some((input) => input.id === current)) {
        return current;
      }
      return nextInputs[0].id;
    });
  }, []);

  const handleMidiMessage = useCallback((event: MIDIMessageEvent) => {
    const data = event.data;
    if (!data || data.length < 2) return;
    const [statusByte, note, velocityRaw] = data;
    const command = statusByte & 0xf0;
    const velocityValue = velocityRaw ?? 0;
    const timestamp = event.timeStamp;
    let type: MidiNoteEvent['type'] | null = null;

    if (command === 0x90 && velocityValue > 0) {
      type = 'noteon';
    } else if (command === 0x80 || (command === 0x90 && velocityValue === 0)) {
      type = 'noteoff';
    }

    if (!type) return;

    emitInput({
      type,
      midiNote: note ?? 0,
      velocity: type === 'noteoff' ? 0 : velocityValue,
      timestamp,
      source: 'webmidi',
    });
  }, []);

  const requestMidiAccess = useCallback(async () => {
    const navigatorWithMidi = navigator as NavigatorWithMidi;

    if (!navigatorWithMidi.requestMIDIAccess) {
      setStatus('unsupported');
      return;
    }

    setStatus('requesting');
    setError(null);

    try {
      const access = await navigatorWithMidi.requestMIDIAccess({
        sysex: false,
      });
      accessRef.current = access;
      access.onstatechange = () => refreshInputs(access);
      refreshInputs(access);
      setStatus('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to access MIDI.');
      setStatus('error');
    }
  }, [refreshInputs]);

  const syncActiveNotes = useCallback(() => {
    const nextNotes: number[] = [];
    activeKeysRef.current.forEach((key) => {
      const midiNote = KEY_TO_MIDI[key];
      if (typeof midiNote === 'number') {
        nextNotes.push(midiNote);
      }
    });
    nextNotes.sort((a, b) => a - b);
    setActiveNotes(nextNotes);
  }, []);

  const emitMockEvent = useCallback((event: MidiNoteEvent) => {
    emitInput(event);
    setRecentMockEvents((previous) => [event, ...previous].slice(0, 4));
  }, []);

  useEffect(() => {
    const access = accessRef.current;
    if (!access) return;

    const nextInput =
      inputs.find((input) => input.id === selectedInputId) ?? null;

    if (activeInputRef.current && activeInputRef.current !== nextInput) {
      activeInputRef.current.onmidimessage = null;
    }

    activeInputRef.current = nextInput;

    if (nextInput) {
      nextInput.onmidimessage = handleMidiMessage;
    }

    return () => {
      if (nextInput) {
        nextInput.onmidimessage = null;
      }
    };
  }, [handleMidiMessage, inputs, selectedInputId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (shouldIgnoreKeyEvent(event)) return;
      if (event.repeat) return;

      const key = event.key.toLowerCase();
      const midiNote = KEY_TO_MIDI[key];
      if (typeof midiNote !== 'number') return;
      if (activeKeysRef.current.has(key)) return;

      activeKeysRef.current.add(key);
      syncActiveNotes();
      emitMockEvent({
        type: 'noteon',
        midiNote,
        velocity,
        timestamp: getEventTimestamp(event),
        source: 'mock',
      });
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (shouldIgnoreKeyEvent(event)) return;

      const key = event.key.toLowerCase();
      const midiNote = KEY_TO_MIDI[key];
      if (typeof midiNote !== 'number') return;
      if (!activeKeysRef.current.has(key)) return;

      activeKeysRef.current.delete(key);
      syncActiveNotes();
      emitMockEvent({
        type: 'noteoff',
        midiNote,
        velocity: 0,
        timestamp: getEventTimestamp(event),
        source: 'mock',
      });
    };

    const handleBlur = (event: FocusEvent) => {
      if (activeKeysRef.current.size === 0) return;

      const keys = Array.from(activeKeysRef.current.values());
      activeKeysRef.current.clear();
      syncActiveNotes();

      keys.forEach((key) => {
        const midiNote = KEY_TO_MIDI[key];
        if (typeof midiNote !== 'number') return;

        emitMockEvent({
          type: 'noteoff',
          midiNote,
          velocity: 0,
          timestamp: getEventTimestamp(event),
          source: 'mock',
        });
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [emitMockEvent, syncActiveNotes, velocity]);

  useEffect(() => {
    return () => {
      if (activeInputRef.current) {
        activeInputRef.current.onmidimessage = null;
      }
      if (accessRef.current) {
        accessRef.current.onstatechange = null;
      }
    };
  }, []);

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
      recentMockEvents,
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
      recentMockEvents,
      requestMidiAccess,
      selectedInputId,
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

export { KEY_LAYOUT };
