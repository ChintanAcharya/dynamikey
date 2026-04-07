import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { emitInput } from './inputBus';
import type { MidiNoteEvent } from './midiEvents';

type MidiStatus = 'idle' | 'requesting' | 'ready' | 'error' | 'unsupported';

type NavigatorWithMidi = Navigator & {
  requestMIDIAccess?: (options?: { sysex?: boolean }) => Promise<MIDIAccess>;
};

/**
 * Render controls for connecting and selecting Web MIDI devices.
 * @returns React element.
 */
function WebMidiInput() {
  const accessRef = useRef<MIDIAccess | null>(null);
  const activeInputRef = useRef<MIDIInput | null>(null);
  const [status, setStatus] = useState<MidiStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [inputs, setInputs] = useState<MIDIInput[]>([]);
  const [selectedInputId, setSelectedInputId] = useState('');

  const navigatorWithMidi = navigator as NavigatorWithMidi;

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
    const velocity = velocityRaw ?? 0;
    const timestamp = event.timeStamp;
    let type: MidiNoteEvent['type'] | null = null;

    if (command === 0x90 && velocity > 0) {
      type = 'noteon';
    } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
      type = 'noteoff';
    }

    if (!type) return;

    const midiEvent: MidiNoteEvent = {
      type,
      midiNote: note ?? 0,
      velocity: type === 'noteoff' ? 0 : velocity,
      timestamp,
      source: 'webmidi',
    };
    emitInput(midiEvent);
  }, []);

  const requestAccess = useCallback(async () => {
    if (!navigatorWithMidi.requestMIDIAccess) {
      setStatus('unsupported');
      return;
    }
    setStatus('requesting');
    setError(null);
    try {
      const access = await navigatorWithMidi.requestMIDIAccess({ sysex: false });
      accessRef.current = access;
      access.onstatechange = () => refreshInputs(access);
      refreshInputs(access);
      setStatus('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to access MIDI.');
      setStatus('error');
    }
  }, [navigatorWithMidi, refreshInputs]);

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

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-black/40">
            MIDI devices
          </div>
          <p className="mt-1 text-sm text-black/60">
            Connect a hardware controller to drive note events.
          </p>
        </div>
        <span className="rounded-full border border-black/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-black/50">
          {statusLabel}
        </span>
      </div>

      {status !== 'ready' && (
        <button
          type="button"
          onClick={requestAccess}
          className="mt-4 rounded-full border border-black/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-black transition hover:border-black/40"
        >
          Enable MIDI
        </button>
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
    </div>
  );
}

export default WebMidiInput;
