---
date: 2026-08-31T20:26:15+02:00
researcher: maciejzadworny
git_commit: 26c729832356ed0596507b30815f54bbf8ae341b
branch: main
repository: Manager_Pad
topic: "What exists on public `/` today, how guests reach signup/login, and what S-01 must not steal from S-02"
tags: [research, codebase, landing-page, auth, astro, topbar]
status: complete
last_updated: 2026-08-31
last_updated_by: maciejzadworny
---

# Research: Selling landing page (replace the starter)

**Date**: 2026-08-31T20:26:15+02:00
**Researcher**: maciejzadworny
**Git Commit**: 26c729832356ed0596507b30815f54bbf8ae341b
**Branch**: main
**Repository**: Manager_Pad

## Research Question

`/10x-research selling-landing-page` — ground S-01 in the live codebase: what a visitor sees at `/`, how existing signup and log in are reached, where starter copy and public-path “Dashboard” live, and which files must stay untouched because post-login destination is S-02 (`login-lands-in-app`).

This change already has `plan.md`. Research confirms those assumptions against source rather than inventing a new design.

## Summary

Public `/` is still the 10x Astro starter. `src/pages/index.astro` renders `Welcome.astro` inside `Layout.astro` with no `title` prop, so the tab title defaults to **10x Astro Starter**. The page is unauthenticated SSR: no `prerender`, no React islands, no `client:*`. Cosmic orbs, star field, and glass cards live in `Welcome.astro`; the shared `bg-cosmic` utility lives in `src/styles/global.css` and is reused by auth and in-app shells.

Auth is already complete enough to link. Hero CTAs go to `/auth/signin` (filled, first) and `/auth/signup` (outline). Guest Topbar offers the same routes. Signed-in Topbar shows email, **Dashboard** → `/dashboard`, and Sign out (`POST /api/auth/signout` → `/`). `/` is not on `PROTECTED_ROUTES`. Successful sign-in still redirects to `/` (`src/pages/api/auth/signin.ts:19`) — that is S-02; leaving it after this change is correct.

Honest product copy for the three problem cards is already in `context/foundation/prd.md` (notes hard to find, commitments buried, not a DIY wiki). `AGENTS.md` has no public-page section yet. The stack-assessment paste block includes an S-02 sentence (“do not send a successful sign-in to `/`”); the existing plan’s Phase 2 wording is the one to paste, not the unedited block.

## Detailed Findings

### Public homepage composition

`src/pages/index.astro` is eight lines: import `Welcome` + `Layout`, then `<Layout><Welcome /></Layout>` with no title and no `prerender`. Session is not read here; `Topbar` (imported only from `Welcome.astro:2,28`) reads `Astro.locals.user`.

Guest-visible starter strings in `Welcome.astro`:

| Slot          | Current text                                                                                       | Lines   |
| ------------- | -------------------------------------------------------------------------------------------------- | ------- |
| H1            | 10x Astro Starter                                                                                  | 35      |
| Subhead       | A production-ready starter with authentication, modern tooling, and a cosmic developer experience. | 37–38   |
| Primary CTA   | Sign In → `/auth/signin` (filled purple)                                                           | 41–46   |
| Secondary CTA | Sign Up → `/auth/signup` (outline)                                                                 | 47–52   |
| Card 1        | Authentication Ready                                                                               | 74–76   |
| Card 2        | Modern Stack (copy still says “Astro 5”; repo is Astro 6)                                          | 97–99   |
| Card 3        | Developer Experience                                                                               | 119–121 |

`Topbar` is not used anywhere except `Welcome.astro`. Renaming `Welcome.astro` → `Landing.astro` does not break other routes.

### Layout title and meta

`src/layouts/Layout.astro:10` defaults `title` to `"10x Astro Starter"`. Applied as `<title>{title}</title>` only — no OG, description, or social cards.

Pages that already pass `title=`:

- `dashboard.astro` → `"Dashboard"`
- `auth/signin.astro` → `"Sign in"`
- `auth/signup.astro` → `"Sign up"`
- `auth/confirm-email.astro` → dynamic heading
- `employees/[id].astro` → `"Person"`
- `meetings/[id].astro` → `"Meeting"`

Only `/` inherits the starter default. Changing the Layout default to `"Manager Pad"` therefore only affects `/` among current callers; passing `title="Manager Pad"` from `index.astro` is equivalent and more local.

### Cosmic / glass visual language

- Shared gradient: `@utility bg-cosmic` in `src/styles/global.css:113-115`. Used by Welcome, auth pages, dashboard, employees, meetings. Keep it; do not treat it as homepage-only.
- Orbs (purple / blue / indigo blur) and star field: `Welcome.astro:6-25` only.
- Glass cards: `rounded-xl border border-white/10 bg-white/5 … backdrop-blur-xl` (`Welcome.astro:58+`).
- Auth pages use the same cosmic + glass tokens without orbs/stars.

Keeping that look on the selling page is a copy/card swap, not a restyle.

### Auth path from the public page

**Middleware** (`src/middleware.ts:4,18-24`): `PROTECTED_ROUTES = ["/dashboard", "/employees", "/meetings"]`. Unauthenticated hits on those prefixes redirect to `/auth/signin`. `/` is public. There is no signed-in bounce off `/`.

**Session**: middleware sets `context.locals.user` via Supabase `getUser()` (`middleware.ts:9-16`). Typed in `src/env.d.ts`. Topbar is SSR-only. Do not prerender `/` while Topbar depends on the session.

**Sign-in** (`src/pages/api/auth/signin.ts:19`): `return context.redirect("/")`. S-02 owns retargeting this. An implementer who changes it has stolen scope.

**Sign-out** (`src/pages/api/auth/signout.ts:9`): always `redirect("/")`. Keep.

**Signup** (`src/pages/api/auth/signup.ts:19`): redirects to `/auth/confirm-email`, not `/`. Confirm page already links back to sign-in. Landing does not need a new registration system.

**Auth pages** (`signin.astro`, `signup.astro`): complete email/password forms (`SignInForm` / `SignUpForm` with `client:load`), cross-links, cosmic glass cards. Landing CTAs should be plain `<a href>` to these routes — no second island.

**Hero CTA order today** is Sign In primary / Sign Up secondary. Product intent (new visitor as primary persona) wants Sign up primary / Log in secondary. That is a real delta, not already done.

### Public-path vs in-app “Dashboard”

Public-path (visible on `/`):

- Only `src/components/Topbar.astro:14` — signed-in link text **Dashboard**, `href="/dashboard"`. Guests never see it.

In-app (parked polish — do not change in S-01):

- `src/pages/dashboard.astro:8` — Layout title `"Dashboard"`
- `src/components/teams/TeamList.tsx:115` — “Team Dashboard”
- `src/components/employees/PersonShell.tsx` — “Back to dashboard” / nav “Dashboard”
- `src/components/meetings/MeetingCapture.tsx:141` — “Back to dashboard”
- `src/components/employees/EmployeeList.tsx:185` — “…from your dashboard.”

Renaming the Topbar link to **Open the app** while keeping `href="/dashboard"` is the S-01 language change. URL stays; in-app labels stay.

### Product copy sources

`prd-v2.md` / `shape-notes.md` require the public page to state what the app is and which problems it solves; they do not lock CTA strings. Honest problem phrasing is in v1 `context/foundation/prd.md:20-22`:

1. Notes from many 1-on-1s become hard to navigate; general notebooks have no 1-on-1 structure.
2. Commitments written down do not show up across meetings.
3. Notion-style tools can approximate this if you set them up yourself; this product is purpose-built for the manager 1-on-1 workflow.

The existing plan’s locked copy table is a faithful condensation of that. “How it works” is parked (`roadmap.md` Parked; `prd-v2` nice-to-have).

### Agent conventions gap

`AGENTS.md` has Testing (“do not invent a test runner”) and island preference, but **no** public-page section. Without one, a later agent is likely to:

1. Put `/` on `PROTECTED_ROUTES`
2. Rebuild the landing as a React island
3. Invent a second signup
4. Add a test runner “to cover” the page
5. Retarget `signin.ts` if they paste the **unedited** stack-assessment block

`context/foundation/stack-assessment.md:100` says: after login, do not send a successful sign-in to `/`. That sentence is S-02. `context/foundation/health-check.md:206-211` still says to copy that block unedited into `AGENTS.md`. The selling-landing-page plan Phase 2 wording replaces it with “post-login destination is not this change — see `login-lands-in-app`.” Implementers should follow the plan, not the health-check copy instruction.

README.md still titles the repo “10x Astro Starter”. Out of scope for S-01 (plan: do not rewrite README).

### Verification constraints

No test runner (`AGENTS.md` Testing; stack-assessment failed gates). CI is lint + build. Guest/signed-in landing checks are browser-only. Lesson in `context/foundation/lessons.md`: prefer UI-first phases — this change has no schema, so two UI phases on the existing Astro surface is the right shape.

## Code References

- `src/pages/index.astro:1-8` — `/` composition; no title; no prerender
- `src/components/Welcome.astro:5-125` — starter hero, CTAs, three feature cards, orbs, star field, Topbar
- `src/components/Welcome.astro:35-52` — H1 “10x Astro Starter”; Sign In primary / Sign Up secondary
- `src/components/Topbar.astro:2` — `Astro.locals.user`
- `src/components/Topbar.astro:13-15` — signed-in **Dashboard** → `/dashboard` (only public-path “Dashboard” string)
- `src/components/Topbar.astro:27-31` — guest Sign in / Sign up
- `src/layouts/Layout.astro:10` — default title `"10x Astro Starter"`
- `src/layouts/Layout.astro:19` — `<title>{title}</title>` only (no OG)
- `src/styles/global.css:113-115` — shared `bg-cosmic` utility
- `src/middleware.ts:4` — `PROTECTED_ROUTES`; `/` not listed
- `src/middleware.ts:18-24` — unauthenticated protected-route bounce to `/auth/signin`; no signed-in bounce from `/`
- `src/pages/api/auth/signin.ts:19` — `redirect("/")` (S-02; do not change)
- `src/pages/api/auth/signout.ts:9` — `redirect("/")`
- `src/pages/api/auth/signup.ts:19` — `redirect("/auth/confirm-email")`
- `src/pages/auth/signin.astro` / `src/pages/auth/signup.astro` — existing auth UI ready to link
- `src/env.d.ts:2-4` — `locals.user` type
- `AGENTS.md:30-32` — no test runner; no public-page section yet
- `context/foundation/prd.md:20-22` — problem phrasing for honest cards
- `context/foundation/stack-assessment.md:95-103` — AGENTS paste block including S-02 sentence
- `context/foundation/health-check.md:206-211` — still instructs unedited paste (conflicts with plan)

## Architecture Insights

- **Homepage is a static Astro tree**, not an island. `index` → `Layout` → `Welcome` → `Topbar`. Replacing starter copy does not require React. Prefer renaming `Welcome` → `Landing` so the starter component name does not survive.
- **Session chrome forces SSR.** Topbar reads `Astro.locals.user` set in middleware. `output: "server"` already applies; do not add `prerender = true` on `/`.
- **Auth is a link target, not a new subsystem.** Signup, sign-in, confirm-email, and cookie sessions already work. S-01’s job is copy + CTA order + public-path language.
- **S-01 / S-02 split is load-bearing.** Shape/PRD bundled sell-page + post-login into one blast radius; the roadmap sliced them so the north star can ship under a speed bias. Live code still has `signin.ts` → `/` and no signed-in middleware bounce. Both are expected until S-02.
- **Shared cosmic chrome vs homepage-only decoration.** `bg-cosmic` is app-wide. Orbs/stars are Welcome-only. Keep both on the selling page; do not delete `bg-cosmic` while restyling.
- **Instruction-file trap.** Pasting stack-assessment line 100 into `AGENTS.md` during S-01 would tell the implementer to “finish” S-02. Use the plan’s S-01-scoped wording.
- **UI-first with no schema.** Lesson: interactive surface first. Here the surface already exists; phases are guest sell page, then signed-in chrome + agent rules.

## Historical Context (from prior changes)

- `context/foundation/roadmap.md:36-45` — S-01 is the M-2 north star; S-02 is parallel, not a prerequisite.
- `context/foundation/roadmap.md:96` — split exists so the selling page can ship without waiting on destination/wording.
- `context/changes/selling-landing-page/change.md:12` — “Post-login destination is S-02 — do not steal it.”
- `context/changes/selling-landing-page/plan.md` — already locks copy, cosmic retention, Topbar “Open the app”, two UI phases, and the S-01-scoped AGENTS paste. Live code matches the plan’s Current State Analysis.
- `context/foundation/lessons.md:5-10` — UI-first phases; applies here as two Astro UI slices, no schema.
- `context/archive/2026-08-15-person-overview-task-followup/` — in-app dashboard nav only; not a landing-page precedent. Older change IDs named S-01/S-02 belong to M-1 (teams/meetings), not this split.
- `login-lands-in-app` has no change folder yet (roadmap status `ready`).

## Related Research

None. This is the first `research.md` in the repo. Plan-brief “Source: Research” for Astro / no-tests referred to `stack-assessment.md` + `AGENTS.md`, not a change-local research file.

## Open Questions

- **Signed-in user later opening `/`:** bounce into the app, or still show the landing? Roadmap S-02 unknown; owner is the user; does **not** block S-01. Default today (show landing + Topbar “Open the app”) is the S-01 behavior.
- **README still markets the starter.** Out of scope per plan; leftover for a later hygiene change.
- **Health-check vs plan on AGENTS paste.** Health-check still says copy the unedited stack-assessment block. Not a product unknown — follow the plan when implementing S-01.
- **GitHub permalinks** were not added: `main` is 15 commits ahead of `origin/main`, so HEAD blobs are not on GitHub yet.
