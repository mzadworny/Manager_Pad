---
project: manager-pad
researched_at: 2026-07-21
recommended_platform: Cloudflare Workers
runner_up: Netlify
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Astro 6 SSR
  runtime: Cloudflare Workers (workerd via @astrojs/cloudflare v13)
---

## Recommendation

**Deploy on Cloudflare Workers.**

Manager Pad is already bootstrapped for this target: `@astrojs/cloudflare` v13.5, `wrangler` v4.90, and a configured `wrangler.jsonc` with `nodejs_compat`. At MVP traffic (10k–100k requests/month), the Workers Free tier covers the workload at **$0/month** — the strongest fit for the interview answer "minimize cost." The platform scored 5/5 on agent-friendly criteria (CLI-first ops, managed serverless, `llms.txt` docs, deterministic deploy API, official MCP servers). Supabase remains external, which the user indicated is acceptable. Cloudflare Pages was explicitly ruled out: `@astrojs/cloudflare` v13+ deploys to Workers with static assets, not Pages.

## Platform Comparison

| Platform | CLI-first | Managed/Serverless | Agent-readable docs | Stable deploy API | MCP / Integration | Total |
|---|---|---|---|---|---|---|
| Cloudflare | Pass | Pass | Pass | Pass | Pass | 5 Pass |
| Vercel | Pass | Pass | Partial | Pass | Pass | 4 Pass, 1 Partial |
| Netlify | Partial | Pass | Partial | Partial | Pass | 2 Pass, 3 Partial |
| Fly.io | Partial | Pass | Partial | Partial | Partial | 1 Pass, 4 Partial |
| Railway | Partial | Pass | Pass | Partial | Pass | 3 Pass, 2 Partial |
| Render | Partial | Pass | Pass | Partial | Pass | 3 Pass, 2 Partial |

### Notes per platform

**Cloudflare Workers** — Full marks on all five criteria. `wrangler deploy`, `wrangler rollback`, and `wrangler tail` cover the agent operational loop. Docs publish `llms.txt`, per-page markdown, and GitHub source. Official MCP servers (GA) cover docs, bindings, and observability. Free tier: 100k requests/day, 10ms CPU/invocation. Paid floor: $5/mo if CPU limits are hit. Already configured in this repo — zero adapter migration.

**Vercel** — Strong CLI and MCP (GA at `mcp.vercel.com`). Astro 6 SSR via `@astrojs/vercel` (GA). Partial on docs (hosted `llms.txt` but no GitHub markdown source). Cost penalty: Hobby is non-commercial only; commercial MVP requires Pro at ~$20/mo. Requires adapter swap from `@astrojs/cloudflare`. Slight familiarity bonus from interview, but cost and migration outweigh it.

**Netlify** — Official `@netlify/mcp` (GA) and Astro 6 day-one support via `@astrojs/netlify`. Partial on CLI (no CLI rollback — dashboard only) and stable deploy API. Free tier (300 credits/mo) likely covers light SSR at MVP traffic. Requires adapter swap. Runner-up primarily on cost parity with Cloudflare.

**Fly.io** — Container PaaS with persistent processes and WebSocket support (GA), but no free tier (trial only, ~$3–6/mo minimum). Partial across CLI (image-based rollback only), docs (no `llms.txt`), deploy API, and MCP (`fly mcp` experimental). Requires Dockerfile + `@astrojs/node` adapter swap. Managed Postgres starts at ~$38/mo — irrelevant since Supabase is external.

**Railway** — Excellent agent docs (`llms.txt`, remote MCP at `mcp.railway.com` GA). Partial on CLI (no CLI rollback) and deploy API. Bills CPU/RAM uptime, not requests: ~$10–20/mo minimum for always-on SSR. Free plan is $1/mo credit. Requires `@astrojs/node` adapter swap. Region-limited to 4 regions.

**Render** — Good agent docs (`llms.txt`, hosted MCP GA). Partial on CLI (rollback via Dashboard/API only). ~$7/mo Starter for always-on SSR; free tier sleeps after 15 min idle (conflicts with autosave UX). Requires `@astrojs/node` adapter swap. Third shortlisted alternative.

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

Won on every agent-friendly criterion and zero migration cost — the repo ships with `@astrojs/cloudflare` v13.5, `wrangler.jsonc`, and `nodejs_compat`. At MVP traffic, cost is $0 on the Free tier. Strongest MCP and documentation story for agent-driven maintenance. Trade-offs (workerd runtime limits, Supabase cross-region latency, 10ms CPU ceiling) are documented in the risk register.

#### 2. Netlify

Second on cost — free tier (300 credits/mo) likely covers 10k–100k light SSR requests. Official MCP server and Astro 6 support. Gap vs. recommendation: requires adapter migration to `@astrojs/netlify`, no CLI rollback, and SSR cold starts on serverless functions.

#### 3. Render

Third as the lowest-cost always-on Node alternative (~$7/mo Starter). Full Web Service with persistent process, official MCP, and good docs. Gap vs. recommendation: requires adapter migration, no free always-on tier (free sleeps after 15 min), and ~$7/mo vs. $0.

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate — Weaknesses

1. **workerd ≠ Node.js** — Astro 6 SSR runs in `workerd`, not Node. Libraries using `sharp`, `node:fs`, or other Node-only APIs can fail. `nodejs_compat` helps but does not guarantee parity.
2. **Supabase SSR cookie edge cases** — `@supabase/ssr` patterns using relative `fetch('/')` can break in workerd. Auth session refresh is a common production failure mode.
3. **CPU time ceiling on Free** — 10ms CPU per invocation on the Free tier. React 19 island SSR pages with middleware could exceed this, forcing an unexpected upgrade to the $5/mo Paid plan.
4. **Pages vs Workers confusion** — `@astrojs/cloudflare` v13+ dropped Pages support. Older tutorials and the tech-stack hint (`deployment_target: cloudflare-pages`) point to a deprecated path.
5. **External DB latency** — Workers run globally; Supabase Postgres sits in one region. Cross-region round-trips on autosave requests can conflict with the PRD's "immediate navigation" requirement.

### Pre-Mortem — How This Could Fail

The team shipped Manager Pad on Cloudflare Workers because the starter already had `@astrojs/cloudflare` configured and the free tier looked perfect. Local dev with `npm run dev` worked fine in workerd. Production broke on week three when Supabase auth cookies stopped refreshing — the SSR middleware used a relative fetch that workerd resolved differently than Node. Fixing it required rewriting auth helpers, costing two evenings.

Then autosave started timing out. Each note edit triggered an API route that hit Supabase in `eu-central-1` while the Worker ran at the nearest edge POP — adding 150–200ms per save. With ~20 reportees and rich-text autosave, managers noticed lag. The team considered Hyperdrive but it was not in the MVP plan.

By month four, one complex person-overview page with React islands exceeded the 10ms free-tier CPU limit intermittently. Errors were opaque ("Worker exceeded CPU time"). Upgrading to the $5/mo plan fixed it, but the team lost a week debugging. Meanwhile, GitHub Actions only ran lint/build — no deploy pipeline existed, so every production push was manual `wrangler deploy`. The MVP shipped, but the infrastructure decision created recurring tax that a $7/mo always-on Render box would have avoided.

### Unknown Unknowns

- **`astro dev` already runs workerd locally** — runtime fidelity in dev is built in; `wrangler dev` is supplementary for binding-specific testing, not required for day-to-day iteration.
- **Secrets live in two places** — `astro:env/server` schema in `astro.config.mjs` plus Wrangler secrets (`.dev.vars` locally, `wrangler secret put` in prod). Mismatch causes build-time vs runtime errors.
- **No deploy pipeline exists yet** — CI only lint/builds; wiring GitHub Actions → `wrangler deploy` is still ahead, including `CLOUDFLARE_API_TOKEN` setup.
- **Preview environments need separate builds** — per-environment deploys require `CLOUDFLARE_ENV=… astro build`; PR previews are not automatic like Vercel/Netlify Git integrations.
- **Observability is enabled but unconfigured** — `wrangler.jsonc` has `observability.enabled: true`, but log retention and alerting need explicit setup.

## Operational Story

- **Preview deploys**: Not configured yet. Options: (a) add a GitHub Actions workflow that runs `npx wrangler deploy --env preview` on PR events, producing a Workers preview URL; (b) use Cloudflare Workers Builds (GA) connected to the GitHub repo for automatic preview deployments per branch. Fork PRs require `CLOUDFLARE_API_TOKEN` with appropriate scopes in GitHub Secrets. Protect preview URLs with Cloudflare Access if they expose real data.
- **Secrets**: Production secrets (`SUPABASE_URL`, `SUPABASE_KEY`) via `npx wrangler secret put SUPABASE_URL` and `npx wrangler secret put SUPABASE_KEY`. Local dev secrets in `.dev.vars` (gitignored). CI build secrets in GitHub Actions repository secrets (already used for lint/build). Wrangler secrets are readable by account members with Workers edit permissions; rotation = re-run `wrangler secret put` and redeploy.
- **Rollback**: `npx wrangler rollback [VERSION_ID]` — list versions with `npx wrangler deployments list`. Typical revert time: under 30 seconds. Database migrations (Supabase) do not roll back automatically; coordinate schema changes separately.
- **Approval**: Human required for first-time Cloudflare account linking, production secret rotation, and Supabase migration apply. Agent may run `npm run build`, `npx wrangler deploy`, `npx wrangler tail`, and read-only log queries unattended once credentials are configured.
- **Logs**: Runtime: `npx wrangler tail` (live stream) or Cloudflare dashboard Observability tab. Build/deploy: GitHub Actions run logs. MCP: Cloudflare observability MCP server for structured log queries. CLI deploy output confirms URL on success.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| workerd runtime breaks Node-only library | Devil's advocate | M | H | Avoid `sharp`/`node:fs`; test in `npm run dev` (workerd); keep `nodejs_compat` flag; pin dependencies that support Workers |
| Supabase auth cookies fail in production | Devil's advocate / Pre-mortem | M | H | Use absolute URLs in `@supabase/ssr` helpers; verify auth flow in `npm run preview` before first deploy; test sign-in/sign-out/sign-up end-to-end |
| Free-tier 10ms CPU limit exceeded on SSR pages | Devil's advocate / Pre-mortem | M | M | Monitor CPU in Observability; optimize heavy React islands; budget $5/mo Paid plan if complex pages exceed limit |
| Cross-region Supabase latency on autosave | Devil's advocate / Pre-mortem | M | M | Co-locate Supabase project region with primary user geography; consider Cloudflare Hyperdrive if latency persists post-MVP |
| Pages vs Workers config confusion | Devil's advocate / Unknown unknowns | L | M | Deploy via `wrangler deploy` to Workers only; ignore Cloudflare Pages tutorials; update `tech-stack.md` hint when convenient |
| No automated deploy pipeline | Unknown unknowns / Pre-mortem | H | M | Add GitHub Actions deploy workflow with `CLOUDFLARE_API_TOKEN`; test on a staging Worker before production |
| Secrets mismatch between Astro env schema and Wrangler | Unknown unknowns | M | M | Mirror secret names exactly; document in `.env.example`; validate in CI build step (already runs with GitHub Secrets) |
| Preview deploys expose staging data | Unknown unknowns | L | M | Use separate Supabase project or branch for preview; protect preview URLs with Cloudflare Access |

## Getting Started

1. **Authenticate Wrangler** — `npx wrangler login` (opens browser OAuth; requires Cloudflare account).
2. **Configure local secrets** — copy `.env.example` to `.dev.vars` and fill in `SUPABASE_URL` and `SUPABASE_KEY` for Cloudflare local runtime.
3. **Develop locally** — `npm run dev` (Astro 6 dev server runs in workerd for production parity; no separate `wrangler dev` needed for daily work).
4. **Verify production build** — `npm run build && npm run preview` to catch workerd-specific issues before deploy.
5. **Deploy to Workers** — `npm run build && npx wrangler deploy` (uses existing `wrangler.jsonc` with `@astrojs/cloudflare/entrypoints/server` and static assets from `./dist`).
6. **Set production secrets** — `npx wrangler secret put SUPABASE_URL` and `npx wrangler secret put SUPABASE_KEY` (one-time; re-run on rotation).
7. **Wire CI deploy** (next step) — add a GitHub Actions workflow on merge to `master` that runs `npm run build && npx wrangler deploy` with `CLOUDFLARE_API_TOKEN` in repository secrets.

## Out of Scope

The following were not evaluated in this research:

- Docker image configuration
- CI/CD pipeline setup (noted as next step, not designed here)
- Production-scale architecture (multi-region failover, HA, DR)
