import MockKeyboardInput from '../features/input/MockKeyboardInput';
import WebMidiInput from '../features/input/WebMidiInput';

/**
 * Render the available MIDI input sources.
 * @returns Input section.
 */
function InputSection() {
  return (
    <section className="p-4">
      <div className="grid gap-8 lg:grid-rows-2">
        <WebMidiInput />
        <MockKeyboardInput />
      </div>
    </section>
  );
}

export default InputSection;
