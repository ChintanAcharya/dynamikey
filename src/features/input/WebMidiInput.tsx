import { useInputRuntime } from './InputRuntimeContext';

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
          onClick={() => {
            void requestMidiAccess();
          }}
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
