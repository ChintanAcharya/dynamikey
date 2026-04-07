# Dynamikey

Dynamikey is a React + TypeScript practice app for MusicXML-based keyboard lessons. It loads lesson files from [`lessons/`](./lessons), parses them into structured lesson data, renders notation with VexFlow, and lets you work through the material using either a connected MIDI device or a mock computer-keyboard input.

The current app includes:

- A lesson browser driven by `.musicxml` files in [`lessons/`](./lessons)
- MusicXML parsing and normalization for interactive playback
- A staff view with tempo controls and transport feedback
- Web MIDI input support for hardware keyboards
- A mock keyboard input mode for local testing without MIDI hardware

For local setup and development commands, see [`CONTRIBUTING.md`](./CONTRIBUTING.md).
