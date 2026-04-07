import MockKeyboardInput from '../features/input/MockKeyboardInput';
import WebMidiInput from '../features/input/WebMidiInput';

/**
 * Render the available MIDI input sources.
 * @returns Input section.
 */
function InputSection() {
  return (
    <section className="rounded-3xl border border-black/10 bg-white/85 p-6 shadow-[0_20px_80px_rgba(15,15,15,0.08)]">
      <div className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-black/40">
        Inputs
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <WebMidiInput />
        <MockKeyboardInput />
      </div>
    </section>
  );
}

export default InputSection;
