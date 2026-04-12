# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

## Commands

```bash
npm run dev          # Start Vite dev server (http://localhost:5173)
npm run build        # Production build
npm run lint         # ESLint
npm run typecheck    # TypeScript type-check (tsc -b)
npm run preview      # Preview production build
```

There is no test suite. Pre-commit hooks (via lefthook) run Prettier automatically on staged files — no need to run it manually.

Node.js 24 is required (version pinned in `.nvmrc`).

## Architecture

The app is a single-page React 19 + TypeScript app built with Vite 8. Path aliases are configured so `@/` maps to `src/`.

### Data flow: MusicXML → rendered notation

1. **Lesson catalog** (`src/features/musicxml/lessonCatalog.ts`) — uses `import.meta.glob` to discover all `.musicxml` files in `lessons/` at build time. Lessons are lazy-loaded on demand via `loadLessonXml`.
2. **Parser** (`src/features/musicxml/musicXmlParser.ts`) — converts raw MusicXML into the `Lesson` type defined in `lessonModel.ts`. The model normalises pitch (`midiNote`), timing (`startBeat`, `durationBeats`), and dynamics.
3. **VexFlow renderer** (`src/features/vexflowStaff/lib/renderLesson.ts`) — takes a `Lesson` and an `HTMLDivElement`, lays out measures into lines, and draws directly to an SVG via VexFlow 4. The layout pipeline is: `prepareMeasures` → `splitMeasuresIntoLines` → `rebalanceLines` → stave/voice drawing → hairpin overlays.

### Transport

`TransportClock` (`src/features/transport/transportClock.ts`) is a plain class that advances beats from `performance.now()`. It supports count-in, play, pause, and end phases. The `useLessonTransport` hook drives a `requestAnimationFrame` loop that calls `transport.update()` each frame and publishes a `TransportSnapshot` to React state.

### Input

Two input sources share a single pub/sub bus (`src/features/input/lib/inputBus.ts`):

- **Web MIDI** — `useWebMidiAccess` subscribes to `MIDIInput` message events and emits `MidiNoteEvent` onto the bus.
- **Mock keyboard** — `useMockKeyboardInput` maps computer keyboard keys to MIDI notes and emits the same event type.

`InputRuntimeProvider` / `useInputRuntime` expose combined input state (active notes, MIDI device list, velocity) to the component tree via context.

### Feedback / scoring

`useMidiLessonFeedback` (`src/features/vexflowStaff/hooks/useMidiLessonFeedback.ts`) subscribes to the input bus and compares incoming notes against the lesson timeline using the `ScoringConfig` from `lessonModel.ts` (timing tolerance, velocity tolerance, pitch strictness).

### Pages & routing

Routes are defined in `App.tsx` using React Router 7. Pages (`src/pages/`) are lazy-loaded:

- `/lesson/:id` — `LessonPage` (staff view + transport + feedback)
- `/input` — `InputPage` (MIDI device management + mock keyboard)

`AppLayout` provides the sidebar shell. The sidebar is built with shadcn/ui components.

### UI components

`src/components/ui/` contains shadcn/ui primitives. Feature-specific components live inside their feature directory (e.g. `src/features/vexflowStaff/components/`).

### Adding a lesson

Drop a `.musicxml` file into `lessons/`. Vite's glob import picks it up automatically on the next dev server restart or build — no code changes needed.
