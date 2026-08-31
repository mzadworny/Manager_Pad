# Login Lands in the App Implementation Plan

## Overview

Successful sign-in lands in the app at `/dashboard`, not back on the public selling page. Signed-in visits to `/` still show the landing; public-path copy and in-app “Dashboard” labels stay as S-01 left them.

## Current State Analysis

S-01 replaced the starter `/` with a selling landing. Guests Sign up / Log in; signed-in Topbar says **Open the app** → `/dashboard`. `/dashboard` is the real app home (`TeamList`). Middleware already gates `/dashboard`, `/employees`, `/meetings`.

The miss is one redirect: `src/pages/api/auth/signin.ts` still `redirect("/")` after `signInWithPassword`. Sign-in is a classic form POST (`SignInForm` → `/api/auth/signin`); the browser follows the 302. There is no `redirectTo`. Sign-out correctly returns to `/`. Signup still goes to confirm-email, then the same sign-in path.

`AGENTS.md` still says post-login destination is **not** this change. After this plan, that sentence is wrong.

## Desired End State

A manager signs in from `/auth/signin` (via the landing or a bookmarked auth URL) and lands on `/dashboard` with their session, teams, and people intact. Guests can still open `/`. A signed-in user who later opens `/` still sees the landing plus **Open the app**. Failed sign-in still returns to `/auth/signin?error=…`. Sign-out still returns to `/`.

Verify in the browser: guest `/` → Log in → sign in → `/dashboard`. Then open `/` while still signed in → selling page, not a bounce.

### Key Discoveries:

- Load-bearing miss is `src/pages/api/auth/signin.ts:19` — success `redirect("/")`; `/dashboard` is already the hub (`src/pages/dashboard.astro` renders `TeamList`)
- No `redirectTo` / return-URL anywhere; middleware bounce to `/auth/signin` drops the original path (`src/middleware.ts:18-21`)
- `/` is not on `PROTECTED_ROUTES`; there is no signed-in bounce from `/` (`src/middleware.ts:4`)
- Public-path “Dashboard” is already gone (`src/components/Topbar.astro:13-14` is **Open the app**); in-app labels remain parked polish
- Auth API routes lack `export const prerender = false` while product APIs have it — add it on the file this change already edits
- `AGENTS.md:44` still defers post-login to this change; stack-assessment paste (`context/foundation/stack-assessment.md:100`) is the live rule to install

## What We're NOT Doing

- Redirecting signed-in users away from `/` in middleware
- `redirectTo` / return-to-origin after login
- Bouncing signed-in users off `/auth/signin` or other `/auth/*` pages
- Changing sign-out (`src/pages/api/auth/signout.ts` stays `redirect("/")`)
- Changing signup or confirm-email destinations
- Auth page copy (“Sign in”) or landing/Topbar copy (already S-01)
- In-app “Dashboard” labels (`dashboard.astro` title, Team Dashboard, Back to dashboard)
- Putting `/` on `PROTECTED_ROUTES`
- Renaming the `/dashboard` URL
- Schema, new auth, health-check.md / stack-assessment.md edits, or a test runner

## Implementation Approach

Two UI-first phases on the existing auth path:

1. Retarget successful sign-in to `/dashboard` so the manager can click through login-into-the-app.
2. Replace the deferred `AGENTS.md` sentence with the live post-login rule so later agents do not send sign-in back to `/` or bounce signed-in users off the landing.

No new routes, islands, or query params. Destination is always `/dashboard`.

## Critical Implementation Details

**Do not “complete” this by bouncing `/`.** A signed-in visit to `/` must still render the selling page. An implementer who adds a signed-in middleware redirect from `/` to `/dashboard` has expanded scope.

**Do not add an open redirect.** Success target is the literal path `/dashboard`, not a request-controlled URL.

---

## Phase 1: Post-login lands on /dashboard

### Overview

After a successful password sign-in, the browser lands on the app home. Error paths, sign-out, signup, and public `/` stay unchanged.

### Changes Required:

#### 1. Sign-in success redirect

**File**: `src/pages/api/auth/signin.ts`

**Intent**: A successful `signInWithPassword` enters the product instead of the public page.

**Contract**: Success redirect target is `/dashboard`. Error and missing-config redirects stay `/auth/signin?error=…`. Export `const prerender = false` (hard rule for `src/pages/api/`; this file currently omits it). Do not read a return URL from the request.

### Success Criteria:

#### Automated Verification:

- `src/pages/api/auth/signin.ts` success redirect is `/dashboard` (not `/`)
- Error redirects still target `/auth/signin`
- `export const prerender = false` is present
- Lint passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Signed out, open `/`, click Log in, sign in with a real account → URL is `/dashboard` and TeamList (teams/people) is visible
- Failed sign-in still returns to `/auth/signin` with an error, no session
- Sign out from `/dashboard` still returns to `/` as a guest
- While signed in, open `/` → selling landing still renders; Topbar **Open the app** still goes to `/dashboard` (no auto-bounce)
- While signed in, open `/auth/signin` → sign-in form still renders (no bounce)
- Team / people / meetings still work from `/dashboard`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Agent conventions for post-login

### Overview

Agents reading `AGENTS.md` treat post-login into `/dashboard` as the live rule, and still must not protect `/` or invent a test runner.

### Changes Required:

#### 1. Public-page / post-login rules

**File**: `AGENTS.md`

**Intent**: Remove the S-01 deferral now that this change owns the destination. Keep `/` public and keep signed-in `/` on the landing.

**Contract**: In `## Public page and post-login (landing-page change)`, replace the bullet that says post-login is **not** this change with a live rule, and tighten the verify bullet. Keep the existing bullets about `/` staying off `PROTECTED_ROUTES`, Astro-not-island, existing signup, and public-path “log in to / open the app.” Do not paste the unedited stack-assessment block (it would duplicate those bullets).

Replacement bullets (adapt to house style; keep this meaning):

- After login, the user must land in the app (`/dashboard`, not `/`). Do not send a successful sign-in to `/`. Do not redirect signed-in users away from `/`; a later visit to the public URL still shows the landing.
- Verify this flow in the browser (open `/`, sign in, confirm `/dashboard`). Do not add a test runner to cover it.

Do not edit `context/foundation/health-check.md` or `context/foundation/stack-assessment.md`.

### Success Criteria:

#### Automated Verification:

- `AGENTS.md` no longer says post-login destination is deferred to `login-lands-in-app`
- `AGENTS.md` states successful sign-in lands in the app (`/dashboard`) and must not bounce signed-in users off `/`
- `src/middleware.ts` still does not list `/` in `PROTECTED_ROUTES` and still has no signed-in bounce from `/`
- `src/pages/api/auth/signout.ts` still redirects to `/`
- Lint passes: `npm run lint`

#### Manual Verification:

- Re-read the public-page section: an agent would retarget `signin.ts` to `/dashboard`, not `/`, and would not add a signed-in bounce from `/`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful.

---

## Testing Strategy

### Unit Tests:

- None. No test runner; do not add one.

### Integration Tests:

- None. CI remains lint + build.

### Manual Testing Steps:

1. Signed out, open `/` — selling page still there
2. Click Log in → `/auth/signin`; sign in with a real account
3. Confirm URL is `/dashboard` and teams/people load
4. Open `/` while still signed in — landing + **Open the app**, not an automatic redirect
5. Sign out → guest `/`
6. Sign in with a wrong password → stay on `/auth/signin` with error
7. From `/dashboard`, open a person and a meeting; they still work

## Performance Considerations

No new client JS or islands. One 302 target change. Do not prerender `/` or `/dashboard`.

## Migration Notes

None. No schema, no session-format change, no data backfill. Existing cookies keep working; only the success Location header changes.

## References

- Roadmap S-02: `context/foundation/roadmap.md`
- PRD: `context/foundation/prd-v2.md` (FR-005 / US-01)
- Prior slice: `context/archive/2026-08-31-selling-landing-page/`
- Stack paste (source of the live AGENTS rule): `context/foundation/stack-assessment.md:96-103`
- Lesson: `context/foundation/lessons.md` (UI-first)
- Sign-in API: `src/pages/api/auth/signin.ts`
- App home: `src/pages/dashboard.astro`
- Middleware: `src/middleware.ts`
- Public `/`: `src/pages/index.astro`, `src/components/Landing.astro`, `src/components/Topbar.astro`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Post-login lands on /dashboard

#### Automated

- [x] 1.1 Sign-in success redirect is `/dashboard` (not `/`) — 9b7a81f
- [x] 1.2 Error redirects still target `/auth/signin` — 9b7a81f
- [x] 1.3 `export const prerender = false` is present on `signin.ts` — 9b7a81f
- [x] 1.4 Lint passes: `npm run lint` — 9b7a81f
- [x] 1.5 Build passes: `npm run build` — 9b7a81f

#### Manual

- [x] 1.6 Sign in from landing Log in → `/dashboard` with TeamList visible — 9b7a81f
- [x] 1.7 Failed sign-in stays on `/auth/signin` with an error, no session — 9b7a81f
- [x] 1.8 Sign out from `/dashboard` returns to guest `/` — 9b7a81f
- [x] 1.9 Signed-in `/` still shows the landing; Topbar Open the app → `/dashboard`; no auto-bounce — 9b7a81f
- [x] 1.10 Signed-in `/auth/signin` still shows the form (no bounce) — 9b7a81f
- [x] 1.11 Team / people / meetings still work from `/dashboard` — 9b7a81f

### Phase 2: Agent conventions for post-login

#### Automated

- [x] 2.1 AGENTS.md no longer defers post-login to `login-lands-in-app` — 6f62046
- [x] 2.2 AGENTS.md requires `/dashboard` after sign-in and forbids a signed-in bounce from `/` — 6f62046
- [x] 2.3 Middleware still leaves `/` public with no signed-in bounce — 6f62046
- [x] 2.4 Sign-out still redirects to `/` — 6f62046
- [x] 2.5 Lint passes: `npm run lint` — 6f62046

#### Manual

- [x] 2.6 Public-page section reads as live post-login-to-app rules, not an S-01 deferral — 6f62046
