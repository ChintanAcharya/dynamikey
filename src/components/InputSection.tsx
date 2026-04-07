import MockKeyboardInput from '../features/input/MockKeyboardInput';
import RecentInputEventsCard from '../features/input/RecentInputEventsCard';
import WebMidiInput from '../features/input/WebMidiInput';

/**
 * Render the available MIDI input sources.
 * @returns Input section.
 */
function InputSection() {
  return (
    <section className="flex flex-col gap-4">
      <WebMidiInput />
      <MockKeyboardInput />
      <RecentInputEventsCard />
    </section>
  );
}

export default InputSection;
