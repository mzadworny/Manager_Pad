# Repository Guidelines

Manager Pad is a manager 1-on-1 notes web app built on the 10x Astro starter: Astro 6 SSR, React 19 islands, Tailwind 4, Supabase auth, Cloudflare Workers. Deeper agent rules live in @CLAUDE.md; product intent in @context/foundation/prd.md.

## Hard Rules

- Full SSR (`output: "server"` in @astro.config.mjs). API routes under `src/pages/api/` must export `const prerender = false`.
- Use `@/*` → `src/*`. Merge Tailwind classes with `cn()` from `@/lib/utils` — never concatenate class strings.
- API handlers: uppercase `GET`/`POST` exports; validate bodies with zod.
- New Supabase tables: enable RLS with per-operation, per-role policies. Migrations: `supabase/migrations/YYYYMMDDHHmmss_short_description.sql`.
- No Next.js directives (`"use client"`). Put shared types in `src/types.ts`, hooks in `src/components/hooks/`, services in `src/lib/`.
- Prefer Astro for static UI; React only when interactivity is required. shadcn/ui lives in `src/components/ui/` (new-york).
- Copy @.env.example to `.env` (Node) or `.dev.vars` (Cloudflare local). Never commit those files. Local Supabase: `npx supabase start` (Docker). Deploy: `npx wrangler deploy`.

## Linear sync

Roadmap sequencing lives in @context/foundation/roadmap.md. Execution board is Linear project **Manager Pad**. Link via `change.md.linear_issue` and the Backlog Handoff **Linear** column. Sync is agent-mediated (Linear MCP) — not automatic:

| Event | Linear state |
|---|---|
| Roadmap `ready` / change `new`…`plan_reviewed` | `Todo` |
| `/10x-plan` → `planned` | comment; keep `Todo` |
| `/10x-implement` → `implementing` | `In Progress` + comment |
| Implement complete → `implemented` / `impl_reviewed` | `In Review` + comment |
| `/10x-archive` / roadmap Done | `Done` + comment |
| Roadmap `blocked` | `Backlog` + blocker noted in description/comment |

Prefer `linear_issue` in commit `Refs:` lines. Skip Linear updates silently when MCP is unavailable or `linear_issue` is null.

## Testing

No test runner or `test` script yet. Do not invent a framework without a product decision; CI does not run tests.

## Planning preference

Prefer **UI-first** implementation phases for product features: interactive shells with local/mock state first (so the manager can click through and give feedback), then schema → API → persistence. See @context/foundation/lessons.md. Pure backend/infra changes may stay schema-first.

## CI and Pull Requests

@.github/workflows/ci.yml runs on push/PR to `master`: `npm ci` → `npx astro sync` → `npm run lint` → `npm run build` with `SUPABASE_URL` and `SUPABASE_KEY` secrets. PRs must pass that gate.

## Project Structure

- `src/pages/` — Astro routes and API endpoints; `src/middleware.ts` protects `PROTECTED_ROUTES` (currently `/dashboard`).
- `src/lib/supabase.ts` — cookie SSR client; secrets via `astro:env/server`.
- `src/components/` — React islands + `ui/`; `src/layouts/`, `src/styles/`.
- `supabase/` — local config; `context/foundation/` — PRD and stack docs.
- Auth APIs: `src/pages/api/auth/{signin,signup,signout}.ts`; pages under `src/pages/auth/`.

## Build, Lint, and Development

- Node `22.14.0` (@.nvmrc). Install with `npm ci`.
- `npm run dev` — Cloudflare workerd local server.
- `npm run lint` / `npm run lint:fix` — ESLint (type-checked); `npm run format` — Prettier.
- `npm run build` / `npm run preview` — production SSR build and preview.
- Pre-commit: husky + lint-staged (`eslint --fix` on `*.{ts,tsx,astro}`; Prettier on `*.{json,css,md}`).
