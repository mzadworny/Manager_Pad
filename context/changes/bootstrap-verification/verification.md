---
bootstrapped_at: 2026-07-09T20:22:09Z
starter_id: 10x-astro-starter
starter_name: "10x Astro Starter (Astro + Supabase + Cloudflare)"
project_name: manager-pad
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: "npm audit --json"
---

## Hand-off

```yaml
starter_id: 10x-astro-starter
package_manager: npm
project_name: manager-pad
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: true
  has_background_jobs: false
```

Manager Pad is a solo, after-hours web app with a 5-week MVP and an end-of-August deadline. The PRD needs login, structured persistence for teams, employees, meetings, and tasks, autosave, and room for optional AI summaries later. The recommended JavaScript default — 10x Astro Starter — bundles TypeScript, Supabase auth and Postgres, and Cloudflare Pages deploy in one agent-friendly stack that passes all four quality gates. Auth and AI feature flags are set from the PRD; payments, realtime, and background jobs are out of scope. Deployment targets Cloudflare Pages with GitHub Actions auto-deploy on merge to main.

## Pre-scaffold verification

| Signal             | Value                                      | Severity | Notes                              |
| ------------------ | ------------------------------------------ | -------- | ---------------------------------- |
| npm package        | not run                                    | —        | git-clone starter; no npm create CLI |
| GitHub repo        | przeprogramowani/10x-astro-starter pushed 2026-05-17 | fresh    | via GitHub API (gh CLI unavailable) |

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: git-clone
**Exit code**: 0
**Files moved**: 31442 (includes node_modules)
**Conflicts (.scaffold siblings)**: none
**.gitignore handling**: moved silently (absent in cwd before scaffold)
**.bootstrap-scaffold cleanup**: deleted

**Notes**: Upstream `.git/` removed before move-up. Existing `context/` preserved verbatim.

## Post-scaffold audit

**Tool**: npm audit --json
**Summary**: 0 CRITICAL, 6 HIGH, 9 MODERATE, 2 LOW
**Direct vs transitive**: 3 direct / 17 total (astro, supabase, wrangler direct; remainder transitive)

#### HIGH findings

- **astro** (direct) — Reflected XSS via unescaped slot name (GHSA-8hv8-536x-4wqp); Host header SSRF (GHSA-2pvr-wf23-7pc7). Fix available.
- **devalue** (transitive) — DoS via sparse array deserialization (GHSA-77vg-94rm-hx3p). Fix available.
- **miniflare** (transitive) — via undici, ws. Fix available.
- **undici** (transitive) — TLS bypass, header injection, DoS, cross-origin routing (multiple GHSA). Fix available.
- **vite** (transitive) — `server.fs.deny` bypass on Windows (GHSA-fx2h-pf6j-xcff). Fix available.
- **ws** (transitive) — Memory exhaustion DoS (GHSA-96hv-2xvq-fx4p). Fix available.

#### MODERATE findings

9 moderate advisories across astro, @cloudflare/vite-plugin, js-yaml, supabase/tar, wrangler, yaml-language-server chain, and related packages. All report fixAvailable: true.

#### LOW findings

2 low advisories (@babel/core, esbuild/undici). Fix available.

## Hints recorded but not acted on

| Hint                       | Value                              |
| -------------------------- | ---------------------------------- |
| bootstrapper_confidence    | first-class                        |
| quality_override           | false                              |
| path_taken                 | standard                           |
| self_check_answers         | null                               |
| team_size                  | solo                               |
| deployment_target          | cloudflare-pages                   |
| ci_provider                | github-actions                     |
| ci_default_flow            | auto-deploy-on-merge               |
| has_auth                   | true                               |
| has_payments               | false                              |
| has_realtime               | false                              |
| has_ai                     | true                               |
| has_background_jobs        | false                              |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- `git init` (if you have not already) to start your own repo history.
- Review any `.scaffold` siblings the conflict policy created and decide which version of each file to keep.
- Address audit findings per your project's risk tolerance — the full breakdown is in this log.
- Copy `.env.example` to `.env` and configure Supabase credentials before running locally.
- Consider upgrading Node to ≥22.12.0 (starter warns on v22.11.0).
