---
starter_id: 10x-astro-starter
package_manager: npm
project_name: manager-pad
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-workers
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
---

## Why this stack

Manager Pad is a solo, after-hours web app with a 5-week MVP and an end-of-August deadline. The PRD needs login, structured persistence for teams, employees, meetings, and tasks, autosave, and room for optional AI summaries later. The recommended JavaScript default — 10x Astro Starter — bundles TypeScript, Supabase auth and Postgres, and Cloudflare Workers deploy in one agent-friendly stack that passes all four quality gates. Auth and AI feature flags are set from the PRD; payments, realtime, and background jobs are out of scope. Deployment targets Cloudflare Workers with GitHub Actions auto-deploy on merge to main.
