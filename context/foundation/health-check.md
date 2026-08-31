---
project: Manager Pad
checked_at: 2026-08-31T17:55:51Z
health_status: critical-issues
context_type: brownfield
language_family: js
stack_assessment_available: true
checks_run:
  - lockfile
  - dependency_audit
  - outdated_deps
  - test_runner
  - ci_cd
  - configuration
audit_findings:
  critical: 0
  high: 12
  moderate: 1
  low: 1
test_runner_detected: false
ci_provider: GitHub Actions
recommended_fixes: 6
---

## Dependency Health

### Lockfile

```
Status: present (package-lock.json)
Package manager: npm
```

### Security Audit

```
Tool: npm audit --json
Summary: 0 CRITICAL, 12 HIGH, 1 MODERATE, 1 LOW
Direct vs transitive: 2 HIGH direct (astro, wrangler); 10 HIGH transitive; 1 MODERATE direct (@astrojs/cloudflare); 1 LOW transitive (esbuild)
```

#### HIGH findings

- **astro** 6.4.8 (direct) — [GHSA-f48w-9m4c-m7f5](https://github.com/advisories/GHSA-f48w-9m4c-m7f5): XSS via unescaped spread attribute names in `renderHTMLElement` (incomplete fix for CVE-2026-54298). Fix: npm reports `astro@7.2.9` (major bump 6 → 7).
- **wrangler** 4.112.0 (direct) — vulnerable range includes `4.16.0–4.113.0` (via miniflare). Fix: update within v4 to `4.127.1` (`npm update wrangler`; wanted already `4.127.1`).
- **@cloudflare/vite-plugin** (transitive) — via wrangler/miniflare. Fix: expected to move with a wrangler update.
- **miniflare** (transitive, effects wrangler) — sharp, undici chain. Fix: wrangler update.
- **undici** 7.x (transitive) — [GHSA-8xcm-r25x-g524](https://github.com/advisories/GHSA-8xcm-r25x-g524): retry interceptor response desync. Fix: wrangler/miniflare update.
- **sharp** &lt;0.35.0 (transitive, effects astro, miniflare) — [GHSA-f88m-g3jw-g9cj](https://github.com/advisories/GHSA-f88m-g3jw-g9cj): libvips CVEs. Fix: npm reports `astro@7.2.9`.
- **brace-expansion** (transitive) — [GHSA-mh99-v99m-4gvg](https://github.com/advisories/GHSA-mh99-v99m-4gvg): DoS via unbounded expansion (CVSS 7.5). Fix: `fixAvailable: true` (transitive bump).
- **fast-uri** 3.0.0–3.1.4 (transitive) — [GHSA-v2hh-gcrm-f6hx](https://github.com/advisories/GHSA-v2hh-gcrm-f6hx): host confusion (CVSS 7.5). Fix: `fixAvailable: true`.
- **js-yaml** 4.0.0–4.3.0 (transitive) — [GHSA-5p4m-2wfm-xmqj](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj): quadratic CPU in `!!omap` (CVSS 7.5). Fix: `fixAvailable: true`.
- **nanoid** ≤3.3.17 (transitive) — [GHSA-28wg-ghj8-5hjv](https://github.com/advisories/GHSA-28wg-ghj8-5hjv): non-secure generators can loop (CVSS 5.9; npm labels HIGH). Fix: `fixAvailable: true`.
- **postcss** ≤8.5.22 (transitive) — [GHSA-fxqj-rqcc-2cmp](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp): incomplete sourceMappingURL fix. Fix: `fixAvailable: true`.
- **svgo** 4.0.0–4.0.1 (transitive) — [GHSA-2p49-hgcm-8545](https://github.com/advisories/GHSA-2p49-hgcm-8545): `removeScripts` leaves some scripts (CVSS 8.2). Fix: `fixAvailable: true`.

#### MODERATE findings

- **@astrojs/cloudflare** 13.7.0 (direct) — pulled in by astro advisory; npm fix `@astrojs/cloudflare@14.2.5` (major 13 → 14).

#### LOW findings

- **esbuild** 0.27.3–0.28.0 (transitive, effects astro) — [GHSA-g7r4-m6w7-qqqr](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr): arbitrary file read on Windows dev server (CVSS 2.5). Fix reported as `astro@7.2.9`.

This check did not apply patches. Do not run `npm audit fix` as part of this report.

### Outdated Dependencies

```
Packages with major version gaps: 8
```

Two or more major versions behind (direct):

- **eslint-plugin-astro**: 1.7.0 → 3.1.0 (2 major versions behind; wanted still 1.7.0)
- **typescript**: 5.9.3 → 7.0.2 (2 major versions behind; wanted still 5.9.3 — do not jump to TypeScript 7 without a product decision)

One major behind, relevant to the audit:

- **astro**: 6.4.8 → 7.2.9
- **@astrojs/cloudflare**: 13.7.0 → 14.2.5
- **@astrojs/react**: 5.0.7 → 6.0.4
- **eslint**: 9.39.4 → 10.9.1
- **@eslint/js**: 9.39.4 → 10.0.1
- **lint-staged**: 16.4.0 → 17.4.1

Minor/patch drift (e.g. wrangler 4.112.0 → 4.127.1, zod, tiptap, lucide-react) is not listed as a major gap.

## Test Suite

```
Test runner: not detected
Tests found: not applicable
Test execution: not attempted
```

⚠ No test runner detected. The agent cannot verify its own changes automatically.

This matches `context/foundation/stack-assessment.md` and `AGENTS.md`: _“No test runner or `test` script yet. Do not invent a framework without a product decision; CI does not run tests.”_ Treat as a **known, accepted gap**, not a silent miss.

Recommended _if_ you later choose to add a runner (product decision first):

```bash
npm init vitest@latest
```

Then add a `test` script to `package.json` and a CI step. Do **not** add this to cover the landing-page change unless you explicitly decide to introduce tests.

For `prd-v2.md` (public page + login-into-the-app), verify in the browser: open `/`, confirm the selling page, sign in, confirm landing in the app — not back on `/`.

## CI/CD

```
Provider: GitHub Actions
Configuration: .github/workflows/ci.yml
```

| Stage      | Status | Notes                                                                             |
| ---------- | ------ | --------------------------------------------------------------------------------- |
| Lint       | ✓      | `npm run lint` (ESLint, type-checked)                                             |
| Test       | ✗      | not configured (no runner)                                                        |
| Build      | ✓      | `npx astro sync` then `npm run build`                                             |
| Type check | ✓      | ESLint `strictTypeChecked` + `astro` build; no separate `tsc` / `astro check` job |
| Security   | ✗      | no `npm audit`, CodeQL, or Dependabot                                             |

## Configuration

### High severity

None. `tsconfig.json` extends `astro/tsconfigs/strict`. `.gitignore` present (includes `.env`, `.dev.vars`).

### Medium severity

None. Formatter: `.prettierrc.json`. Linter: `eslint.config.js`.

### Low severity

- **.editorconfig** — missing. Editors may disagree on indent/charset for files Prettier does not touch. Fix: add a `.editorconfig` (indent 2, UTF-8, trim trailing whitespace, insert final newline).

Also present (not gaps): `.env.example`, `AGENTS.md`, `CLAUDE.md`, `.cursor/rules`.

## Stack Assessment Cross-Reference

```
Stack assessment: context/foundation/stack-assessment.md
Agent readiness (from stack-assess): ready-with-compensation
```

| Quality Gate Gap                               | Health-Check Finding                                                                           | Status                                    |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Test runner absent (training data + docs fail) | No test script, no vitest/jest/playwright config, CI has no test step                          | Reinforced (known, accepted in AGENTS.md) |
| Typed: pass                                    | `tsconfig` strict via Astro preset; ESLint type-checked in CI                                  | Mitigated / aligned                       |
| Convention-based: pass                         | Instruction files present; landing-page paste block from stack-assess **not** yet in AGENTS.md | Partially mitigated                       |

Compensation check: the **Testing** prohibition is in `AGENTS.md`. The **Public page and post-login** block recommended by stack-assess is **not** in `AGENTS.md` yet — agents working on `prd-v2.md` will not see those routing/copy rules unless you paste them.

## Recommended Fixes

### Fix before agent work (Category A)

### 1. Direct HIGH: wrangler (and miniflare/undici chain)

**Impact**: Agents and humans run Wrangler locally and in deploy; a patched v4 is already in range of `^4.112.0`.
**Severity**: high
**Effort**: quick (&lt; 5 min)
**Fix**:

```bash
npm update wrangler
npm audit
```

Review the remaining HIGH count after the update. Do not use `npm audit fix --force`.

### 2. Direct HIGH: astro XSS advisory

**Impact**: Public HTML render path (`src/pages/index.astro` and all Astro pages). npm’s stated fix is Astro 7 — a major upgrade that also pulls `@astrojs/cloudflare` 14.
**Severity**: high
**Effort**: significant (&gt; 1 hour)
**Fix**:

1. Read [GHSA-f48w-9m4c-m7f5](https://github.com/advisories/GHSA-f48w-9m4c-m7f5) and decide whether Astro 6.4.8 is an acceptable risk for this app’s HTML.
2. If you upgrade: plan Astro 6 → 7 and `@astrojs/cloudflare` 13 → 14 as their own change — not mixed into the landing-page PRD.
3. Do not run `npm audit fix --force` to jump majors blindly.

```bash
# only after an explicit upgrade decision
npm install astro@7 @astrojs/cloudflare@14
```

### 3. No test runner (known accepted gap)

**Impact**: Agents cannot auto-verify changes. Stack-assess already compensated this; inventing Vitest during the landing-page change would fight `AGENTS.md`.
**Severity**: high (for agent verification) — **accepted** until a product decision
**Effort**: significant (&gt; 1 hour) _if_ you later add a runner; none if you keep the current policy
**Fix**:

Keep the existing rule. Do not add a runner as part of the landing-page work. If you later decide to add tests:

```bash
npm init vitest@latest
```

Then wire `npm test` into `.github/workflows/ci.yml`.

### 4. Paste stack-assess instruction block into AGENTS.md

**Impact**: Without it, an agent may protect `/`, send login back to `/`, or stand up a second signup flow.
**Severity**: medium
**Effort**: quick (&lt; 5 min)
**Fix**: Copy the “Public page and post-login (landing-page change)” block from `context/foundation/stack-assessment.md` into `AGENTS.md`.

### 5. CI has no security scan

**Impact**: Advisories only show up when someone runs `npm audit` locally.
**Severity**: medium
**Effort**: moderate (15–30 min)
**Fix**: Add a non-blocking audit step, for example:

```yaml
- run: npm audit --audit-level=high
  continue-on-error: true
```

Or enable GitHub Dependabot for npm. Do not fail the whole CI on existing HIGH until you have a patch plan (see items 1–2).

### 6. Missing .editorconfig

**Impact**: Low. Prettier already covers most JS/TS/Astro formatting.
**Severity**: low
**Effort**: quick (&lt; 5 min)
**Fix**: Add `.editorconfig` with `indent_size = 2`, `charset = utf-8`, `end_of_line = lf`, `trim_trailing_whitespace = true`, `insert_final_newline = true`.

### Addressed in upcoming lessons (Category B)

None. This repo already has GitHub Actions CI, `AGENTS.md` / `CLAUDE.md`, and Cloudflare Workers deploy config (`wrangler.jsonc`). Those are not expected gaps here.

## Summary

Health status: critical-issues

The project is operationally strong: lockfile, strict TypeScript, ESLint + Prettier, CI lint and build, instruction files, and a documented deploy path. It is not “healthy” under this check’s bar because there is **no test runner** (accepted in `AGENTS.md` / stack-assess) and **12 HIGH** npm advisories, including direct **astro** (XSS, fix is a major) and **wrangler** (patchable within v4).

Next step: update wrangler, decide whether Astro 7 is in scope separately from the landing page, paste the public-page rules into `AGENTS.md`, then implement `prd-v2.md` with browser verification. Instruction files already exist — you do not need a greenfield-style agent onboarding pass before that work.
