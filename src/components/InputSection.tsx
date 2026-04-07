import MockKeyboardInput from '../features/input/MockKeyboardInput';
import WebMidiInput from '../features/input/WebMidiInput';

/**
 * Render the available MIDI input sources.
 * @returns Input section.
 */
function InputSection() {
  return (
    <section className="grid gap-4 lg:grid-rows-2">
      <WebMidiInput />
      <MockKeyboardInput />
    </section>
  );
}

export default InputSection;
