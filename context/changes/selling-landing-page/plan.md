# Selling Landing Page Implementation Plan

## Overview

Replace the public `/` Astro starter with an honest selling landing page: what Manager Pad is, which problems it solves, and links to existing signup and log in. Post-login destination stays S-02 — this change does not retarget `signin.ts`.

## Current State Analysis

Public `/` is still the 10x starter. `src/pages/index.astro` renders `Welcome.astro` inside `Layout.astro` with no `title` prop, so the document title defaults to **"10x Astro Starter"**. Hero copy, three feature cards (Authentication Ready / Modern Stack / Developer Experience), and CTAs are starter marketing, not product.

Auth already exists and the landing already links to it: Sign In → `/auth/signin`, Sign Up → `/auth/signup`. `/` is not on `PROTECTED_ROUTES`. Successful sign-in redirects to `/` (`src/pages/api/auth/signin.ts`). Signed-in visitors still see the public page; Topbar shows email, **Dashboard** → `/dashboard`, and Sign out.

Roadmap M-2 splits this from S-02 (`login-lands-in-app`). PRD v2 parks “how it works.” Stack assessment prefers Astro (not a React island) and forbids inventing a test runner. `AGENTS.md` does not yet have the recommended public-page paste block.

## Desired End State

A visitor opening `/` sees Manager Pad — not the starter. They can read what the app is and which problems it solves, Sign up (primary) or Log in (secondary) via the existing auth pages, and a signed-in visitor can open the app from Topbar without the public page saying “Dashboard.”

Verify as a guest: product name + one-paragraph “what it is” + three problem cards + Sign up / Log in hit `/auth/signup` and `/auth/signin`. Verify signed in: Topbar **Open the app** → `/dashboard`, Sign out still returns to `/`. Sign-in still lands on `/` until S-02.

### Key Discoveries:

- Homepage is pure Astro SSR (`src/pages/index.astro` → `Welcome.astro` + `Topbar.astro`); no `client:*` islands — keep it that way
- Auth pages already exist at `/auth/signin` and `/auth/signup`; landing must link to them, not add a second registration system
- Only page using `Layout` without a `title` is `index.astro`; changing the Layout default to “Manager Pad” only affects `/` among current routes
- Public-path “Dashboard” string lives only in signed-in Topbar (`src/components/Topbar.astro`); in-app “dashboard” labels are parked polish
- `signin.ts` `redirect("/")` is S-02; leaving it as-is after this change is correct, not a miss
- No test runner; verification is lint/build + browser (`AGENTS.md` Testing)

## What We're NOT Doing

- Changing post-login redirect (`src/pages/api/auth/signin.ts`) — S-02
- Redirecting signed-in users away from `/` in middleware — S-02 open question
- “How the app works” section (prd-v2 nice-to-have; roadmap parked)
- Polished marketing: screenshots, pricing, testimonials, motion, custom fonts, OG/social cards
- In-app “dashboard” labels (`dashboard.astro` title, Team Dashboard, Back to dashboard)
- Putting `/` on `PROTECTED_ROUTES`
- New auth, schema, APIs, or a test runner
- Rewriting README or other starter leftovers outside the public page path
- Restyling auth pages

## Implementation Approach

Two UI-first phases on the existing cosmic Astro surface:

1. Replace starter Welcome with product hero + problem cards + Sign up / Log in CTAs.
2. Rename signed-in Topbar to “Open the app,” set the default document title, and paste S-01-scoped public-page rules into `AGENTS.md`.

Keep the cosmic glass look (orbs, star field, purple CTAs). Prefer renaming `Welcome.astro` → `Landing.astro` so the starter component name does not survive.

## Critical Implementation Details

**Do not “fix” login landing in this change.** After Phase 1–2, a successful sign-in still returns to `/`. That is S-02. An implementer who retargets `signin.ts` or adds a signed-in middleware bounce from `/` has stolen scope.

**Copy is specified, not invented.** Use the locked copy in Phase 1. Honest PRD phrasing is enough; do not escalate into a marketing rewrite.

**AGENTS.md paste must stay S-01-scoped.** The stack-assessment block also tells agents that post-login must not land on `/`. Pasting that sentence here would make S-01 implementers “complete” S-02. Use the Phase 2 wording, not the unedited stack-assessment block.

---

## Phase 1: Selling landing content

### Overview

Guests on `/` can tell what Manager Pad is and which problems it solves, and can reach existing signup or log in. Starter hero/feature copy is gone. Visual language stays cosmic.

### Changes Required:

#### 1. Landing page body

**File**: `src/components/Welcome.astro` (rename to `src/components/Landing.astro` and delete Welcome)

**Intent**: Replace starter marketing with the product sell page: hero, three problem cards, Sign up primary / Log in secondary. Keep Topbar, cosmic orbs, star field, and glass cards.

**Contract**: `index.astro` imports the landing component. Guest-visible copy on `/` must not include “10x Astro Starter”, “Authentication Ready”, “Modern Stack”, or “Developer Experience.”

Locked copy:

| Slot          | Text                                                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| H1            | Manager Pad                                                                                                                                      |
| Subhead       | A place for a manager to keep 1:1, people, and meeting notes — structured so you can follow up on commitments, not lose them in a pile of notes. |
| Card 1 title  | Notes you can find again                                                                                                                         |
| Card 1 body   | Notes from many 1-on-1s become hard to navigate. General notebooks have no 1-on-1 structure.                                                     |
| Card 2 title  | Commitments don’t disappear                                                                                                                      |
| Card 2 body   | When you write down what someone should do, those tasks should show up across meetings — not stay buried in last week’s note.                    |
| Card 3 title  | Built for 1-on-1s, not a DIY wiki                                                                                                                |
| Card 3 body   | Notion-style tools can approximate this if you set them up yourself. Manager Pad is purpose-built for the manager 1-on-1 workflow.               |
| Primary CTA   | Sign up → `/auth/signup` (filled purple button, first in DOM / visual order)                                                                     |
| Secondary CTA | Log in → `/auth/signin` (outline button)                                                                                                         |

Hero CTAs stay plain links to existing auth routes. No React island. No “how it works” block.

#### 2. Index route

**File**: `src/pages/index.astro`

**Intent**: Render the landing component and set the public tab title to the product name.

**Contract**: Pass `title="Manager Pad"` into `Layout`. `/` remains unauthenticated SSR (do not add `prerender = true`; Topbar still needs `Astro.locals.user`).

### Success Criteria:

#### Automated Verification:

- Guest-visible starter strings are gone from the landing component (`10x Astro Starter`, `Authentication Ready`, `Modern Stack`, `Developer Experience`)
- `src/pages/index.astro` passes `title="Manager Pad"` and does not set `prerender = true`
- Lint passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Open `/` signed out: H1 is Manager Pad, subhead states what the app is, three problem cards match the locked copy
- Sign up is the filled primary button and navigates to `/auth/signup`
- Log in is the outline secondary button and navigates to `/auth/signin`
- Existing signup and sign-in pages still work; no new registration UI
- Cosmic background, orbs, and glass cards are still present
- `/` is still reachable while signed out (not redirected to sign-in)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Signed-in chrome and agent conventions

### Overview

Signed-in visitors on `/` can open the app without public-path “Dashboard” language. The default document title is Manager Pad. Agents get S-01-scoped rules so they do not protect `/`, invent a second signup, or steal S-02.

### Changes Required:

#### 1. Signed-in Topbar

**File**: `src/components/Topbar.astro`

**Intent**: Public-path language is enter the app, not “the dashboard.” Guests keep Sign in / Sign up. Sign out stays a POST to `/api/auth/signout`.

**Contract**: Signed-in link text is **Open the app**, `href="/dashboard"` (URL unchanged). Guest-visible Topbar must not contain the string `Dashboard`. Do not add a signed-in redirect away from `/`.

#### 2. Default document title

**File**: `src/layouts/Layout.astro`

**Intent**: Pages that omit `title` (today: `/`) get the product name instead of the starter name.

**Contract**: Default `title` is `"Manager Pad"`. Auth and app pages that already pass `title` stay unchanged.

#### 3. Public-page agent rules

**File**: `AGENTS.md`

**Intent**: Stop later agents from putting `/` on `PROTECTED_ROUTES`, adding a test runner for this page, or inventing a second signup — without instructing them to change the post-login redirect (that is S-02).

**Contract**: Add a section titled `## Public page and post-login (landing-page change)` with these rules (adapt wording to house style; keep this scope):

- The public main page is `src/pages/index.astro`. It is unauthenticated. Do not put it on `PROTECTED_ROUTES` in `src/middleware.ts`.
- Prefer Astro (not a React island) for selling/landing content unless a control truly needs client interactivity.
- Signup from the landing page links to the existing signup path (`/auth/signup`). Do not add a second registration system.
- Log-in from the landing page links to `/auth/signin`. Public-path language is log in to / open the app, not “the dashboard.”
- Post-login destination (do not send a successful sign-in to `/`) is **not** this change — see `login-lands-in-app`.
- Verify this flow in the browser. Do not add a test runner to cover it.

### Success Criteria:

#### Automated Verification:

- `src/components/Topbar.astro` has no `Dashboard` string
- `src/layouts/Layout.astro` default title is `Manager Pad` (no `10x Astro Starter`)
- `AGENTS.md` contains `## Public page and post-login (landing-page change)` and does **not** instruct this change to retarget `signin.ts`
- `src/pages/api/auth/signin.ts` still redirects to `/`
- Lint passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Signed in on `/`: Topbar shows email, **Open the app** navigates to `/dashboard`, Sign out returns to `/`
- Guest Topbar still offers Sign in and Sign up
- Complete a sign-in: still lands on `/` (S-02 not implemented); landing copy is the product page, not the starter
- Team, people, and meetings flows still work from `/dashboard`
- Browser tab for `/` reads Manager Pad

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful.

---

## Testing Strategy

### Unit Tests:

- None. No test runner; do not add one.

### Integration Tests:

- None. CI remains lint + build.

### Manual Testing Steps:

1. Signed out, open `/` — product sell page, not the starter; tab title Manager Pad
2. Click Sign up → existing `/auth/signup`; create nothing required, page loads
3. Back, click Log in → existing `/auth/signin`; sign in with a real account
4. After sign-in, confirm you are on `/` with the selling page (S-02 still pending) and Topbar **Open the app**
5. Click Open the app → `/dashboard`; team/people still there
6. Sign out → `/` as a guest again
7. Confirm `/dashboard` while signed out still redirects to `/auth/signin`

## Performance Considerations

Landing stays server-rendered Astro with no new islands. Do not prerender `/` while Topbar depends on the session. No new assets or font loads.

## Migration Notes

None. No schema, no data, no auth-model change.

## References

- Roadmap S-01: `context/foundation/roadmap.md`
- PRD: `context/foundation/prd-v2.md` (scope); `context/foundation/prd.md` (problem phrasing for copy)
- Shape: `context/foundation/shape-notes.md`
- Stack constraints: `context/foundation/stack-assessment.md`
- Lesson: `context/foundation/lessons.md` (UI-first)
- Public page: `src/pages/index.astro`, `src/components/Welcome.astro`, `src/components/Topbar.astro`
- Auth (link only): `src/pages/auth/signin.astro`, `src/pages/auth/signup.astro`
- Do not touch for S-01: `src/pages/api/auth/signin.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Selling landing content

#### Automated

- [x] 1.1 Guest-visible starter strings are gone from the landing component — 566b981
- [x] 1.2 `index.astro` passes title Manager Pad and does not prerender — 566b981
- [x] 1.3 Lint passes: `npm run lint` — 566b981
- [x] 1.4 Build passes: `npm run build` — 566b981

#### Manual

- [x] 1.5 Guest `/` shows Manager Pad, what-it-is subhead, and three locked problem cards — 566b981
- [x] 1.6 Sign up is primary and goes to `/auth/signup` — 566b981
- [x] 1.7 Log in is secondary and goes to `/auth/signin` — 566b981
- [x] 1.8 Existing auth pages still work; no second registration UI — 566b981
- [x] 1.9 Cosmic look retained — 566b981
- [x] 1.10 `/` still reachable while signed out — 566b981

### Phase 2: Signed-in chrome and agent conventions

#### Automated

- [x] 2.1 Topbar has no Dashboard string
- [x] 2.2 Layout default title is Manager Pad
- [x] 2.3 AGENTS.md has S-01-scoped public-page section
- [x] 2.4 `signin.ts` still redirects to `/`
- [x] 2.5 Lint passes: `npm run lint`
- [x] 2.6 Build passes: `npm run build`

#### Manual

- [x] 2.7 Signed-in `/` Topbar: Open the app → `/dashboard`; Sign out works
- [x] 2.8 Guest Topbar still offers Sign in and Sign up
- [x] 2.9 Sign-in still lands on `/` with the selling page
- [x] 2.10 Team / people / meetings still work from `/dashboard`
- [x] 2.11 Browser tab for `/` reads Manager Pad
