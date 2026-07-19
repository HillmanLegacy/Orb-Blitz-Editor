# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Running on Replit

Two workflows are configured:

- **Orblitz Game** — Vite dev server for the 3D game, port 3000 (`pnpm --filter @workspace/orblitz run dev`)
- **API Server** — Express API server, port 8080 (`PORT=8080 pnpm --filter @workspace/api-server run dev`). Health check at `/api/healthz`.

The project uses Replit's built-in PostgreSQL database (`DATABASE_URL` is auto-injected). To push schema changes, run:
```
pnpm --filter @workspace/db push
```

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── orblitz/            # Orblitz 3D browser game
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## Orblitz Game (`artifacts/orblitz`)

3D browser game built with React Three Fiber (R3F) v9, Three.js, Tailwind v4.

### Key game files:
- `src/App.tsx` — Main app, manages game phase state
- `src/components/game/GameScene.tsx` — Three.js canvas/scene setup
- `src/components/game/GameLogic.tsx` — Core game loop, spawning, collision
- `src/components/game/PlayerOrb.tsx` — Player orb controls and physics
- `src/components/game/Background.tsx` — 3D environment/backgrounds
- `src/components/game/Boss.tsx` — Boss enemies
- `src/components/game/DarkOrbs.tsx` — Enemy orbs
- `src/components/game/Projectiles.tsx` — Projectile system
- `src/components/game/PowerUps.tsx` — Power-up items
- `src/components/game/SoundManager.tsx` — Audio management
- `src/lib/stores/useMagicOrb.tsx` — Main game state store (Zustand)
- `src/lib/stores/useShop.tsx` — Shop/currency state (Zustand)
- `src/lib/stores/useAudio.tsx` — Audio state (Zustand)
- `src/lib/audio/SynthSounds.ts` — Synthesized sound system

### Dependencies:
- `@react-three/fiber` v9 (React 19 compatible)
- `@react-three/drei` v10 (Three.js helpers)
- `@react-three/postprocessing` v3 (visual effects)
- `three` v0.170 (WebGL renderer)
- `zustand` v5 (state management)
- `framer-motion` (UI animations)
- `howler` (audio)
- `gsap` (animations)

### Public assets:
- `public/textures/` — Game textures (asphalt, grass, sand, sky, wood)
- `public/sounds/` — Audio files (background music, sound effects)
- `public/geometries/` — 3D geometry files (heart.gltf)

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.
