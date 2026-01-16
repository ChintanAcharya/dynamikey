# MIDI Dynamics Trainer - Design Document

Status: Draft
Owner: Codex (working document)
Last updated: 2026-01-15

## Goals
- Browser-only web app for MIDI keyboard dynamics training.
- Standard notation display with scrolling staff (Yousician-style).
- Real-time feedback on timing, pitch, and velocity with continuous scoring.
- Lessons stored in-repo, authored in MusicXML via external notation tools.

## Non-goals
- Native/mobile apps.
- In-app notation editor for lesson authoring (MVP).
- Full audio synthesis (metronome only in MVP).

## Key decisions
- MIDI input: Web MIDI API via `webmidi`.
- MusicXML parsing: `opensheetmusicdisplay` (OSMD) parser only.
- Rendering: `vexflow` for custom scrolling notation.
- Lessons stored as MusicXML in-repo; normalized into internal JSON model at runtime.

## User experience overview
1. Connect MIDI device (permission + device selection).
2. Choose an exercise from the list.
3. Set tempo, start exercise; count-in plays for 1 bar.
4. Scrolling staff begins; user plays along.
5. Real-time feedback overlays on notes.
6. Results view with continuous scoring and mistake summary.

## Layout and views
### Connect MIDI
- Device status, device selector, permissions instructions.

### Exercise list
- Exercise cards (title, description, difficulty, duration).
- Start button and tempo default preview.

### Exercise player
- Scrolling staff viewport (primary focus).
- Transport controls: play/pause, count-in, tempo.
- Metronome indicator (visual).
- Feedback strip (timing/pitch/velocity per note).
- Current score summary (live).

### Results
- Overall score and per-dimension scores.
- Timing/velocity histograms.
- Mistakes list (missed notes, wrong pitch, off-velocity).

## Data flow and architecture
```
MusicXML -> OSMD parser -> Internal JSON timeline -> VexFlow renderer
                                         |
                                    Scoring engine
                                         |
                               Real-time feedback UI
```

### Modules
- MIDI Manager
  - Mock instrument input (computer keyboard) for MVP testing.
    - White keys (left to right): `a s d f g h j k` -> C D E F G A B C.
    - Black keys (left to right): `w e t y u` -> C# D# F# G# A#.
    - Black keys align above their nearest white keys; E/B have no black keys.
  - Web MIDI device discovery and input handling (after mock is stable).
  - Emits note-on/note-off events with timestamps.

- Lesson Loader
  - Loads MusicXML from in-repo lessons.
  - Uses OSMD parser to extract measures, notes, dynamics, tempo.
  - Normalizes into internal JSON timeline.

- Transport / Metronome
  - Tempo and count-in scheduling.
  - Keeps authoritative playback timeline.
  - Emits beat ticks for rendering sync.

- Renderer (VexFlow)
  - Draws staff, notes, dynamics markings.
  - Scrolls continuously according to transport time.
  - Supports note overlays for feedback.

- Scoring Engine
  - Matches performed notes to expected notes within timing window.
  - Computes continuous scores for timing, pitch, velocity.
  - Tracks mistakes and aggregates results.

## Lesson format and normalization
### Source format
- MusicXML files stored in-repo (e.g., `lessons/`).
- Authored in MuseScore or similar.

### Internal model (draft)
```ts
type Lesson = {
  id: string;
  title: string;
  timeSignature: [number, number];
  defaultTempo: number;
  measures: Measure[];
  scoring: ScoringConfig;
};

type Measure = {
  index: number;
  beats: number;
  notes: NoteEvent[];
  dynamics?: DynamicMarking[];
};

type NoteEvent = {
  startBeat: number;
  durationBeats: number;
  midiNote: number;
  velocityTarget: number;
};

type DynamicMarking = {
  startBeat: number;
  type: 'ppp' | 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff' | 'fff' | 'cresc' | 'dim';
};

type ScoringConfig = {
  timingToleranceMs: number;
  velocityTolerance: number;
  pitchStrict: boolean;
  weights: { timing: number; pitch: number; velocity: number };
};
```

### Velocity mapping
- Dynamics markings map to target velocity ranges:
  - ppp: 10-20
  - pp: 20-30
  - p: 35-45
  - mp: 50-60
  - mf: 65-75
  - f: 85-95
  - ff: 100-110
  - fff: 115-125
- Crescendo/diminuendo linearly interpolate across marked span.

## Scoring approach
- Match each expected note to the nearest performed note within a timing window.
- Per-note scores:
  - Timing: normalized by tolerance (0-1).
  - Pitch: 1 if exact, else 0 (or penalty if not strict).
  - Velocity: normalized by velocity tolerance (0-1).
- Overall score is weighted average; mistakes tracked separately.

## Baseline lesson
- 3 bars, 4/4, middle C:
  - Bar 1: mf
  - Bar 2: f
  - Bar 3: p
- Metronome count-in: 1 bar.
- MusicXML: `lessons/3bar.musicxml`

## Rendering strategy (VexFlow)
- Scroll direction: sheet moves right to left; playhead stays fixed.
- Pre-layout measures into scrolling lanes.
- Map transport time to horizontal position.
- Render upcoming measures ahead of cursor.
- Overlay feedback markers on notes once played.

## Risks and mitigations
- OSMD parsing coverage: validate dynamics/time signature extraction early.
- VexFlow scrolling performance: keep render window small and reuse glyphs.
- Timing accuracy in browsers: use high-resolution timestamps and audio scheduling.

## Implementation milestones
1. Load and parse MusicXML with OSMD.
   - Add a lessons directory convention and file discovery.
   - Load `lessons/3bar.musicxml` as the baseline fixture.
   - Parse time signature, tempo, notes, and dynamics.
   - Log or surface parser output for validation.
2. Normalize to internal JSON model.
   - Map MusicXML measures to internal measure objects.
   - Convert MusicXML durations to beat-based durations.
   - Resolve dynamics to velocity targets (including cresc/dim spans).
   - Define IDs for notes to support matching and feedback.
3. Render basic staff with VexFlow.
   - Render a single staff with measures and noteheads.
   - Render dynamics markings below staff.
   - Confirm correct spacing for 4/4 quarter notes.
4. Add scrolling timeline + transport sync.
   - Implement a transport clock with count-in and tempo.
   - Map transport time to staff x-position (right-to-left).
   - Render a fixed playhead and scroll notes beneath it.
   - Optimize draw window to reduce render cost.
5. Implement mock instrument input (computer keyboard).
   - Add keyboard event handling (note on/off).
   - Map keys to MIDI notes C4 to C5 using the defined layout.
   - Add configurable velocity for mock input (fixed or slider).
   - Emit mock input events in the same shape as real MIDI.
6. Integrate `webmidi` and basic device handling.
   - Device permission request and selection.
   - Listen for note on/off with timestamps and velocity.
   - Normalize events to internal input format.
7. Define UI layouts and view states.
   - Exercise list view and card layout.
   - Player layout regions (staff, transport, feedback).
   - Connect MIDI state handling and empty states.
8. Results view and data summaries.
   - Aggregate timing/pitch/velocity scores.
   - Show per-note mistakes and totals.
   - Add summary charts for timing and velocity.

## Open questions
- Exact velocity mapping ranges for dynamics.
- Pitch strictness defaults and tolerance values.
- Whether to cache normalized JSON for fast load.
