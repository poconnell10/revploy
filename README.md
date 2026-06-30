# Revploy

React 18 + TypeScript 5 (strict) + Vite 5 application scaffold.

## Stack

- **React 18** + **TypeScript 5** (strict mode) + **Vite 5**
- **Tailwind CSS v3** with CSS-variable-driven design tokens
- **shadcn/ui** (config in `components.json`; primitives live in `src/shared/components/primitives`)
- **React Router v6**
- **TanStack Query v5**
- **React Hook Form** + **Zod**
- **Supabase JS v2** (`src/shared/lib/supabase.ts`)
- **ESLint + Prettier**, with architectural boundaries enforced at `error` level via `eslint-plugin-boundaries`

## Getting started

```bash
npm install
cp .env.example .env   # then fill in the values
npm run dev
```

## Scripts

| Script                 | Description                          |
| ---------------------- | ------------------------------------ |
| `npm run dev`          | Start the Vite dev server            |
| `npm run build`        | Type-check and build for production  |
| `npm run preview`      | Preview the production build         |
| `npm run lint`         | Lint (boundaries enforced as errors) |
| `npm run typecheck`    | Type-check without emitting          |
| `npm run format`       | Format with Prettier                 |
| `npm run format:check` | Verify formatting                    |

## Architecture & boundaries

`src/` is organised into architectural layers, each an `eslint-plugin-boundaries`
element. The allowed dependency directions (anything else is a lint error):

- **shared** (`src/shared/**`) — cross-cutting code; may depend only on **shared**.
- **modules** (`src/modules/<module>/**`) — feature-scoped; may depend on **shared**
  and their _own_ module only (no cross-module imports).
- **layouts** (`src/layouts/**`) — may depend on **shared**.
- **routes** (`src/routes/**`) — may depend on **modules**, **layouts**, **shared**.
- **app** (`src/main.tsx`) — composition root; may depend on anything.

```
src/
  modules/        feature modules (dashboard, properties, admin, logs, …)
  shared/         rbac, events, hooks, components/primitives, lib
  layouts/
  routes/
  main.tsx
supabase/
  migrations/
  functions/      events-dispatcher, ttv-daily-scorer (Deno edge functions)
```

Design tokens are defined as CSS variables in `src/index.css`, exposed to Tailwind
in `tailwind.config.ts`, and mirrored for TypeScript use in `src/shared/lib/tokens.ts`.

## Environment variables

See `.env.example`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_COGNITO_USER_POOL_ID`
- `VITE_COGNITO_CLIENT_ID`
