# Orblitz

An arcade-style 3D orb-shooting game built with React, Three.js (React Three Fiber), and an Express API backend.

## Project Structure

This is a pnpm monorepo with two artifacts:

- **`artifacts/orblitz/`** — Frontend React + Vite + R3F game app (`@workspace/orblitz`)
- **`artifacts/api-server/`** — Express API server (`@workspace/api-server`)

Shared libraries live in `lib/`:
- `lib/api-spec/` — OpenAPI spec and generated client
- `lib/api-zod/` — Zod schemas
- `lib/db/` — Drizzle ORM database setup

## Running the Project

Both services start automatically via the configured workflows:

| Service | Command | Port |
|---------|---------|------|
| Frontend (Orblitz) | `pnpm --filter @workspace/orblitz run dev` | 3000 |
| API Server | `pnpm --filter @workspace/api-server run dev` | 8080 |

To install dependencies: `pnpm install`

## Environment Variables

| Variable | Value | Notes |
|----------|-------|-------|
| `PORT` | `8080` | Required by API server |
| `SESSION_SECRET` | (secret) | Session signing secret |

## Stack

- **Frontend**: React 18, Vite, Three.js via React Three Fiber, Zustand, TailwindCSS, shadcn/ui
- **Backend**: Express 5, Pino logger, esbuild bundler
- **Database**: Drizzle ORM + PostgreSQL
- **Game engine**: R3F (`@react-three/fiber`), `@react-three/drei`, postprocessing
- **Audio**: Howler.js
- **Animation**: GSAP, Framer Motion

## User Preferences

- Keep the existing project structure and stack — do not restructure or migrate.
