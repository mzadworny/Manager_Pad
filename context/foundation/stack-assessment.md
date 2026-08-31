---
project: Manager Pad
assessed_at: 2026-08-31T17:53:04Z
agent_readiness: ready-with-compensation
context_type: brownfield
stack_components:
  language: TypeScript
  framework: Astro 6 (SSR) + React 19 islands
  build_tool: Astro / Vite
  test_runner: null
  package_manager: npm
  ci_provider: GitHub Actions
  deployment_target: Cloudflare Workers
gates_passed: 7
gates_failed: 2
---

## Stack Components

**Language.** TypeScript 5.9 (`package.json` `devDependencies.typescript`). `tsconfig.json` extends `astro/tsconfigs/strict`. ESLint uses `typescript-eslint` `strictTypeChecked` and `stylisticTypeChecked` with `parserOptions.projectService: true` (`eslint.config.js`). Node version is `22.23.1` (`.nvmrc`). Typed: yes.

**Framework.** Astro `^6.3.1` with `output: "server"` (`astro.config.mjs`). File-based routing under `src/pages/` (`.astro` pages and `src/pages/api/` handlers). React 19 islands via `@astrojs/react`; Tailwind 4 via `@tailwindcss/vite`. Auth and data: `@supabase/ssr` and `@supabase/supabase-js`. Validation: `zod`. Instruction files already encode project conventions (`AGENTS.md`, `CLAUDE.md`).

Brownfield change in `context/foundation/prd-v2.md` (landing page + login-into-the-app) sits on this same surface: `src/pages/index.astro` (currently the starter Welcome page), `src/middleware.ts` (`PROTECTED_ROUTES`), and existing auth pages under `src/pages/auth/` plus `src/pages/api/auth/`.

**Build tool.** `astro build` / `astro dev` / `astro preview` (`package.json` scripts). Vite is the bundler (override `vite: ^7.3.2`). Adapter: `@astrojs/cloudflare` with `prerenderEnvironment: "node"` (`astro.config.mjs`).

**Test runner.** Not detected. No `test` script in `package.json`. No `jest.config.*`, `vitest.config.*`, or `playwright.config.*`. CI (`.github/workflows/ci.yml`) runs `npm ci` → `npx astro sync` → `npm run lint` → `npm run build` only.

**Package manager.** npm (`package-lock.json`).

**CI/CD.** GitHub Actions (`.github/workflows/ci.yml`) on push/PR to `master`. Node 22 with npm cache. Secrets: `SUPABASE_URL`, `SUPABASE_KEY` for the build step.

**Deployment.** Cloudflare Workers via `wrangler.jsonc` (`name: manager-pad`, `main: @astrojs/cloudflare/entrypoints/server`, `compatibility_date: 2026-05-08`, `nodejs_compat`). Deploy path documented as `npx wrangler deploy`.

**Instruction files.** `AGENTS.md`, `CLAUDE.md`, `.cursor/rules`. These already document SSR, API `prerender = false`, `@/*` paths, Zod on API bodies, RLS on new tables, no Next.js directives, and the no-test-runner policy.

## Quality Gate Assessment

| Component   | Typed | Convention | Training Data | Documented | Verdict       |
| ----------- | ----- | ---------- | ------------- | ---------- | ------------- |
| Language    | ✓     | —          | —             | —          | pass          |
| Framework   | —     | ✓          | ✓             | ✓          | pass          |
| Build tool  | —     | ✓          | ✓             | ✓          | pass          |
| Test runner | —     | —          | ✗             | ✗          | fail (absent) |

Legend: ✓ = pass, ✗ = fail, ~ = partial, — = not applicable

Applicable cells: 9 (language typed; framework convention / training / docs; build convention / training / docs; test-runner training / docs). Passed: 7. Failed: 2 (both on the missing test runner).

### Gate Details

**Typed — language: pass.** Evidence: `tsconfig.json` `"extends": "astro/tsconfigs/strict"`; `eslint.config.js` extends `tseslint.configs.strictTypeChecked`. An agent can read function and API shapes from source. API routes already validate with Zod (`AGENTS.md` hard rule).

**Convention-based — framework: pass.** Evidence: Astro file-based routing (`src/pages/index.astro`, `src/pages/dashboard.astro`, `src/pages/api/**/*.ts`); island split documented in `AGENTS.md` (“Prefer Astro for static UI; React only when interactivity is required”); middleware at `src/middleware.ts`; API convention `export const prerender = false` plus uppercase `GET`/`POST`. The agent-friendly criteria list Astro as a convention-based example (file-based routes + islands).

**Convention-based — build tool: pass.** Evidence: standard Astro CLI scripts; `astro.config.mjs` is the single config; Cloudflare adapter declared there, not assembled ad hoc.

**Popular in training data — framework: pass (within JS/TS).** Evidence: Astro is a mainstream JS meta-framework; React is the dominant island library in that family. Astro 6.x is newer than 4/5, so prefer current official docs over older island examples — not a fail.

**Popular in training data — build tool: pass (within JS/TS).** Evidence: Vite is the default bundler for Astro and a mainstream JS build tool.

**Popular in training data — test runner: fail.** Evidence: no runner is present, so there is no project-local test idiom for an agent to match. `AGENTS.md` already forbids inventing a framework.

**Well-documented — framework: pass.** Evidence: Astro docs at https://docs.astro.build (versioned); React 19 docs; Tailwind 4 docs; Wrangler / Workers docs. Project also points at `context/deployment/local-and-preview.md`.

**Well-documented — build tool: pass.** Evidence: Astro CLI and Vite docs; `astro.config.mjs` comments the Cloudflare prerender workaround.

**Well-documented — test runner: fail.** Evidence: no runner, no test config, CI does not run tests. Nothing for an agent to look up except the instruction-file prohibition.

## Gaps & Compensation

### Missing test runner (training data + documentation)

**What failed.** There is no test runner, no `test` script, and CI does not run tests (`.github/workflows/ci.yml`; `package.json` scripts).

**Why it matters for agent workflows.** Agents often add tests by default or assume a runner. Without a documented prohibition, they invent Vitest/Playwright and a new CI job — out of scope and against the existing product decision. For the landing-page change, there is no automated check that the public page sells the product or that login lands in the app; verification has to be manual / browser.

**Compensation.** Keep the existing `AGENTS.md` Testing section. Add the paste block below so agents verifying `prd-v2.md` do not stand up a runner to “cover” the landing page.

This gap does **not** mean replace the stack. It means budget manual verification (and browser checks) until a product decision adds a runner. `/10x-health-check` should treat “no tests” as a known, accepted gap rather than a surprise.

### Recommended Instruction File Additions

Already present in `AGENTS.md` (keep):

```markdown
## Testing

No test runner or `test` script yet. Do not invent a framework without a product decision; CI does not run tests.
```

Add to `AGENTS.md` (landing-page / public-route verification):

```markdown
## Public page and post-login (landing-page change)

- The public main page is `src/pages/index.astro`. It is unauthenticated. Do not put it on `PROTECTED_ROUTES` in `src/middleware.ts`.
- Prefer Astro (not a React island) for the selling/landing content unless a control truly needs client interactivity (login/signup controls may use existing auth pages or small islands).
- After login, the user must land in the app (today: routes under `/dashboard`, `/employees`, `/meetings` — not back on `/`). Do not send a successful sign-in to `/` or label that destination “the dashboard” on the public page; the product language is log in to the app.
- Signup from the landing page links to the existing signup path (`/auth/signup`). Do not add a second registration system.
- Verify this flow in the browser (open `/`, read the page, sign in, confirm the in-app landing). Do not add a test runner to “cover” it.
```

## Summary

The stack is **ready with compensation**. TypeScript (strict), Astro 6 SSR, Vite, npm, GitHub Actions, and Cloudflare Workers all pass the agent-friendly criteria that apply to them. Conventions for routing, islands, API handlers, and auth already live in `AGENTS.md` / `CLAUDE.md`. The only failed criteria are on a **missing test runner** — already acknowledged in `AGENTS.md`; the paste block above stops agents from inventing tests for the landing-page change.

**Strengths:** strict TypeScript; Astro file-based routes; documented island vs Astro split; Zod at API boundaries; CI lint + build; instruction files already in the repo.

**Gaps:** no test runner (compensated by instruction, not by adding a framework here). Astro 6 is newer than most training examples — prefer current official docs.

**Next step:** `/10x-health-check` — dependency audit, security scan, and confirmation that the empty test story is recorded as a known gap, not a silent miss.
