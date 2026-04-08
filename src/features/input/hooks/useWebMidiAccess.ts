import { useCallback, useEffect, useRef, useState } from 'react';

import { emitInput } from '@/features/input/lib/inputBus';
import type { MidiNoteEvent, MidiStatus } from '@/features/input/types';

type NavigatorWithMidi = Navigator & {
  requestMIDIAccess?: (options?: { sysex?: boolean }) => Promise<MIDIAccess>;
};

export function useWebMidiAccess() {
  const accessRef = useRef<MIDIAccess | null>(null);
  const activeInputRef = useRef<MIDIInput | null>(null);
  const [status, setStatus] = useState<MidiStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [inputs, setInputs] = useState<MIDIInput[]>([]);
  const [selectedInputId, setSelectedInputId] = useState('');

  const refreshInputs = useCallback((access: MIDIAccess) => {
    const nextInputs = Array.from(access.inputs.values());
    setInputs(nextInputs);
    setSelectedInputId((current) => {
      if (nextInputs.length === 0) {
        return '';
      }

      if (current && nextInputs.some((input) => input.id === current)) {
        return current;
      }

      return nextInputs[0]?.id ?? '';
    });
  }, []);

  const handleMidiMessage = useCallback((event: MIDIMessageEvent) => {
    const data = event.data;
    if (!data || data.length < 2) {
      return;
    }

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

    if (!type) {
      return;
    }

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

  useEffect(() => {
    const access = accessRef.current;
    if (!access) {
      return;
    }

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
    return () => {
      if (activeInputRef.current) {
        activeInputRef.current.onmidimessage = null;
      }

      if (accessRef.current) {
        accessRef.current.onstatechange = null;
      }
    };
  }, []);

  return {
    error,
    inputs,
    requestMidiAccess,
    selectedInputId,
    setSelectedInputId,
    status,
  };
}
