# Contributing

## Run locally

### Prerequisites

- Node.js 24. I recommend using [nvm](https://github.com/nvm-sh/nvm) or [mise](https://mise.jdx.dev/). They will pick up the appropriate version from the nvmrc file.

### Install dependencies

```bash
npm install
```

### Start the development server

```bash
npm run dev
```

Vite will print a local URL, typically `http://localhost:5173`.

### Other useful commands

```bash
npm run build
npm run lint
npm run typecheck
npm run preview
```

## Project notes

- Application source code lives in [`src/`](./src).
- Static assets live in [`public/`](./public).
- Lesson files live in [`lessons/`](./lessons) and are loaded automatically when they use the `.musicxml` extension.
- Web MIDI input depends on browser support and permission to access connected MIDI devices.
