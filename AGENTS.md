# AGENTS.md

## Project overview

- React + TypeScript app built with Vite.
- Static assets live in `public/`; app code in `src/`.
- Audio/music assets appear to live under `lessons/`.

## Dev commands

- `npm run dev` to start the Vite dev server.
- `npm run build` to type-check and build.
- `npm run lint` to run ESLint.
- `npm run preview` to serve the production build.

## Conventions

- Use functional React components and TypeScript types for props/state.
- Keep component logic in `src/` and static files in `public/`.
- Follow existing ESLint/Prettier defaults; avoid reformatting unrelated code.
- DO NOT type any variable as `any`. Always use proper Typescript types
- Run eslint and typescript and fix errors introduced by your changes, while keeping functionality intact.
