---
project: manager-pad
deployed_at: 2026-08-06
platform: Cloudflare Workers
worker_name: manager-pad
worker_url: https://manager-pad.maciejzadworny.workers.dev
version_id: 68f98052-36ba-43c3-a1af-2c656358b2c3
cloudflare_account_id: ad968d68ba3bf311b3d9f597683a4600
supabase_project_ref: tgtlhokduherbfkycoxh
supabase_region: eu-central-1
---

# Deploy plan — Cloudflare Workers

Living deploy notes for Manager Pad on Cloudflare Workers (not Pages). First ship was 2026-07-23; latest successful publish is below. Day-to-day local vs preview guidance: [local-and-preview.md](./local-and-preview.md). Platform rationale: `context/foundation/infrastructure.md`.

## Current production

| Item | Value |
| --- | --- |
| Platform | Cloudflare Workers |
| Worker name | `manager-pad` |
| URL | https://manager-pad.maciejzadworny.workers.dev |
| Version ID | `68f98052-36ba-43c3-a1af-2c656358b2c3` (2026-08-06) |
| Runtime | workerd via `@astrojs/cloudflare` v13 + `nodejs_compat` |
| External DB/Auth | Supabase project `Manager_Pad` (`tgtlhokduherbfkycoxh`, eu-central-1) |
| App surface on Worker | Auth + teams/employees API + dashboard UI (`TeamList` island) |

Previous version (first ship / starter placeholder dashboard): `b2717cb5-a63c-4e98-baf0-3eb1e558684a` (2026-07-23).

## Repeatable publish (what works today)

Two systems: **remote Supabase schema** and **Worker code**. Push schema when migrations change; redeploy the Worker when app/API/UI changes. CI (`.github/workflows/ci.yml`) only lint/builds — it does **not** deploy.

```bash
nvm use   # Node from .nvmrc (22.23.1; >= 22.15 required for registerHooks)

# 1) Schema — only when supabase/migrations/ has pending remote changes
npx supabase db push          # linked project tgtlhokduherbfkycoxh
npx supabase migration list --linked   # confirm local == remote

# 2) App build (uses .dev.vars for build-time env; production reads Worker secrets)
npm run build

# 3) Strip adapter-generated legacy_env (wrangler 4.112 rejects it — required after every build)
python3 - <<'PY'
import json
from pathlib import Path
p = Path("dist/server/wrangler.json")
data = json.loads(p.read_text())
removed = data.pop("legacy_env", None)
p.write_text(json.dumps(data, indent=2) + "\n")
print("stripped legacy_env:", removed is not None)
PY

# 4) Publish
npx wrangler deploy
```

Deploy uses redirected config: `dist/server/wrangler.json` (from `@astrojs/cloudflare` build). Root `wrangler.jsonc` remains the user source of truth.

Secrets are already set on the Worker — re-run only on rotation:

```bash
printf '%s' "$SUPABASE_URL" | npx wrangler secret put SUPABASE_URL
printf '%s' "$SUPABASE_KEY" | npx wrangler secret put SUPABASE_KEY
npx wrangler secret list
```

### Smoke after each publish

| Check | Expect |
| --- | --- |
| `GET /` | 200 |
| `GET /auth/signin` | 200 |
| `GET /dashboard` (no session) | 302 → `/auth/signin` |
| Sign in → Dashboard | Teams/employees UI (or empty-state CTA), not the old “only for authenticated users” card |
| Create team → refresh | Data persists (remote Supabase + RLS) |

Local workerd parity before publish: `npm run build && npm run preview` → `http://127.0.0.1:4321`.

## Secrets (names only)

| Secret | Where | Status |
| --- | --- | --- |
| `SUPABASE_URL` | Worker secrets (`wrangler secret put`) | done |
| `SUPABASE_KEY` | Worker secrets (`wrangler secret put`) | done |
| `SUPABASE_URL` | Local `.dev.vars` (gitignored) | done |
| `SUPABASE_KEY` | Local `.dev.vars` (gitignored) | done |
| Same names | GitHub Actions CI build secrets | used by `.github/workflows/ci.yml` |

## Bindings

| Binding | Resource | Notes |
| --- | --- | --- |
| `SESSION` | KV Namespace `manager-pad-session` (`95b40ba1a96f4c249a5069bdc179f544`) | Auto-provisioned by Astro Cloudflare adapter |
| `IMAGES` | Cloudflare Images | Adapter default |
| `ASSETS` | Static assets from `dist/client` | |

## Human gates (one-time / rare)

| Gate | Status | Notes |
| --- | --- | --- |
| Cloudflare `wrangler login` | done | Account: Maciejzadworny@gmail.com's Account |
| Supabase project + keys | done | Project `Manager_Pad`; keys in `.dev.vars` / Worker secrets |
| `wrangler secret put` | done | Non-interactive stdin from `.dev.vars` |
| Supabase Auth Site URL / Redirect URLs | done | Site URL = `https://manager-pad.maciejzadworny.workers.dev`; Redirect URLs: `https://manager-pad.maciejzadworny.workers.dev/**`, `http://localhost:4321/**` |

## Schema on remote (as of 2026-08-06)

Remote migrations applied via `npx supabase db push` (linked ref `tgtlhokduherbfkycoxh`):

| Migration | Remote |
| --- | --- |
| `20260727000001_create_teams_and_employees.sql` | applied |
| `20260804105500_add_soft_delete_rpc_functions.sql` | applied (2026-08-06) |

Local Docker (`npx supabase start`) is separate from this remote project. Always `db push` before expecting new tables/RPCs on workers.dev.

## Known deploy friction

1. **`legacy_env` in generated `dist/server/wrangler.json`** — `@astrojs/cloudflare` still emits it; wrangler 4.112 rejects it. Strip after every `npm run build` before `wrangler deploy` (snippet above). Rebuilding without stripping fails with that exact error.
2. **No CI auto-deploy yet** — intentional; wiring GitHub Actions → `wrangler deploy` is still ahead.
3. **Working tree vs git** — `wrangler deploy` publishes whatever you just built locally. Uncommitted UI/API can go live before it lands on `main`; commit when the slice is ready.
4. **Wrangler post-deploy prompt** — may ask to install Cloudflare agent skills; answer `n` unless you want that.

## Rollback

```bash
npx wrangler deployments list
npx wrangler rollback [VERSION_ID]
```

Database migrations (Supabase) do **not** roll back with the Worker. Coordinate schema separately.

## First-ship repo changes (2026-07-23, still in effect)

- Renamed Worker / package from `10x-astro-starter` → `manager-pad` (`wrangler.jsonc`, `package.json`)
- `tech-stack.md` hint: `deployment_target: cloudflare-workers`
- `.nvmrc` → `22.23.1`
- `astro.config.mjs`: `prerenderEnvironment: "node"`
- Gitignored `.dev.vars` with Supabase URL + anon key

## Next

1. Manual E2E on production: empty CTA → create team/employee → edit/delete → refresh → second-user isolation.
2. Optional: npm `predeploy` (or similar) that strips `legacy_env` so the step can’t be forgotten.
3. Add GitHub Actions deploy on merge to `master`: build → strip → `wrangler deploy` with `CLOUDFLARE_API_TOKEN` (and account id if required).
4. Optional later: PR preview Workers (see Operational Story in `infrastructure.md`).
