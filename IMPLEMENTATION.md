# Implementation Plan

This document expands the milestones in `DESIGN.md` into concrete, actionable steps.

## 1. Load and parse MusicXML with OSMD
- Add a lessons directory convention and file discovery (e.g., `lessons/*.musicxml`).
- Load `lessons/3bar.musicxml` as the baseline fixture.
- Parse the MusicXML into OSMD structures (score, parts, measures).
- Extract time signature, tempo, notes, rests, and dynamics.
- Validate extracted data against the MVP score (counts, pitches, dynamics).

## 2. Normalize to internal JSON model
- Define a normalized in-memory model for lesson playback.
- Convert MusicXML durations to beat-based durations using divisions.
- Map measures to absolute timeline positions (bar index + beat offset).
- Translate dynamics markings to target velocity ranges.
- Resolve cresc/dim spans into per-note target velocities.
- Generate stable IDs for notes for matching and feedback.

## 3. Render basic staff with VexFlow
- Render a single staff with correct clef and time signature.
- Lay out MVP measures with quarter-note spacing.
- Render noteheads and stems for the MVP lesson.
- Render dynamic markings under the staff.
- Confirm vertical spacing for dynamics and ledger lines.

## 4. Add scrolling timeline + transport sync
- Implement a transport clock with tempo and count-in.
- Keep a fixed playhead; move notes right-to-left.
- Map transport time to x-position using beat-to-pixel scaling.
- Render a sliding window of measures for performance.
- Keep rendering independent from parsing logic.

## 5. Implement mock instrument input (computer keyboard)
- Capture keydown/keyup events for the mock layout.
- Map keys to MIDI notes from C4 to C5:
  - White keys: `a s d f g h j k` -> C D E F G A B C
  - Black keys: `w e t y u` -> C# D# F# G# A#
- Provide a fixed velocity (or simple slider) for mock input.
- Emit mock events in the same format as MIDI input.

## 6. Integrate `webmidi` and basic device handling
- Request MIDI access and enumerate devices.
- Allow device selection and handle hot-plug events.
- Listen for note-on/note-off with timestamp + velocity.
- Normalize events to the same format as mock input.

## 7. Define UI layouts and view states
- Exercise list view with lesson metadata.
- Player view: staff viewport, transport, feedback strip, tempo control.
- MIDI connection view and error states.
- Map state transitions: connect -> select -> count-in -> play -> results.

## 8. Results view and data summaries
- Aggregate per-note scores into timing/pitch/velocity scores.
- Summarize mistakes: missed, wrong pitch, off-velocity.
- Render timing and velocity distributions.
- Provide basic recommendations (e.g., “play softer on p section”).
