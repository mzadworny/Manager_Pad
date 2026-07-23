---
project: manager-pad
deployed_at: 2026-07-23
platform: Cloudflare Workers
worker_name: manager-pad
worker_url: https://manager-pad.maciejzadworny.workers.dev
version_id: b2717cb5-a63c-4e98-baf0-3eb1e558684a
cloudflare_account_id: ad968d68ba3bf311b3d9f597683a4600
supabase_project_ref: tgtlhokduherbfkycoxh
supabase_region: eu-central-1
---

# Deploy plan — first production ship

Audit trail for the first Manager Pad deploy to Cloudflare Workers (not Pages), per `context/foundation/infrastructure.md` and stack constraints in `context/foundation/tech-stack.md`.

## Outcome

| Item | Value |
| --- | --- |
| Platform | Cloudflare Workers |
| Worker name | `manager-pad` |
| URL | https://manager-pad.maciejzadworny.workers.dev |
| Version ID | `b2717cb5-a63c-4e98-baf0-3eb1e558684a` |
| Runtime | workerd via `@astrojs/cloudflare` v13 + `nodejs_compat` |
| External DB/Auth | Supabase project `Manager_Pad` (`tgtlhokduherbfkycoxh`) |

## Commands used

```bash
npx wrangler login
npx wrangler whoami
npm run build          # Node >= 22.15 required (registerHooks); used 22.23.1
npm run preview        # local workerd smoke
# Strip adapter-generated legacy_env (wrangler 4.112 rejects it), then:
npx wrangler deploy
printf '%s' "$SUPABASE_URL" | npx wrangler secret put SUPABASE_URL
printf '%s' "$SUPABASE_KEY" | npx wrangler secret put SUPABASE_KEY
npx wrangler secret list
```

Deploy used redirected config: `dist/server/wrangler.json` (from `@astrojs/cloudflare` build), with root `wrangler.jsonc` as the user source of truth.

## Secrets wired (names only)

| Secret | Where | Status |
| --- | --- | --- |
| `SUPABASE_URL` | Worker secrets (`wrangler secret put`) | done |
| `SUPABASE_KEY` | Worker secrets (`wrangler secret put`) | done |
| `SUPABASE_URL` | Local `.dev.vars` (gitignored) | done |
| `SUPABASE_KEY` | Local `.dev.vars` (gitignored) | done |
| Same names | GitHub Actions CI build secrets | already used by `.github/workflows/ci.yml` |

## Bindings provisioned on first deploy

| Binding | Resource | Notes |
| --- | --- | --- |
| `SESSION` | KV Namespace `manager-pad-session` (`95b40ba1a96f4c249a5069bdc179f544`) | Auto-provisioned by Astro Cloudflare adapter |
| `IMAGES` | Cloudflare Images | Adapter default |
| `ASSETS` | Static assets from `dist/client` | |

## Human gates

| Gate | Status | Notes |
| --- | --- | --- |
| Cloudflare `wrangler login` | done | Account: Maciejzadworny@gmail.com's Account |
| Supabase project + keys | done | Project `Manager_Pad`; keys in `.dev.vars` / Worker secrets |
| `wrangler secret put` | done | Non-interactive stdin from `.dev.vars` |
| Supabase Auth Site URL / Redirect URLs | done | Site URL = `https://manager-pad.maciejzadworny.workers.dev`; Redirect URLs: `https://manager-pad.maciejzadworny.workers.dev/**`, `http://localhost:4321/**`. |

## Verification

### Local preview (`npm run preview` → `http://127.0.0.1:4321`)

| Check | Result |
| --- | --- |
| `GET /` | 200 |
| `GET /auth/signin` | 200 |
| `GET /auth/signup` | 200 |
| `GET /dashboard` (no session) | 302 → `/auth/signin` |

### Production (`https://manager-pad.maciejzadworny.workers.dev`)

| Check | Result |
| --- | --- |
| `GET /` | 200 |
| `GET /auth/signin` | 200 |
| `GET /auth/signup` | 200 |
| `GET /dashboard` (no session) | 302 → `/auth/signin` |

Full interactive sign-in / sign-up / confirm-email should be re-checked after Auth URL Configuration is saved.

## Repo changes made during this deploy

- Renamed Worker / package from `10x-astro-starter` → `manager-pad` (`wrangler.jsonc`, `package.json`)
- Updated `context/foundation/tech-stack.md` hint: `deployment_target: cloudflare-workers`
- `.nvmrc` → `22.23.1` (Astro/Vite need `node:module.registerHooks`; 22.14.0 failed builds)
- `astro.config.mjs`: `prerenderEnvironment: "node"` (avoids local workerd prerender hang on `Request.cf`)
- Created gitignored `.dev.vars` with Supabase URL + anon key

## Known deploy friction

1. **`legacy_env` in generated `dist/server/wrangler.json`** — `@astrojs/cloudflare` still emits `legacy_env`, which wrangler 4.112 rejects. Strip it after each build before deploy until the adapter catches up.
2. **First build is slow** (~4–5 min types/collect) on cold machine; subsequent builds are faster.
3. **No CI auto-deploy yet** — intentional; infrastructure.md lists this as next step.

## Rollback

```bash
npx wrangler deployments list
npx wrangler rollback [VERSION_ID]
```

No application schema migrations shipped in this deploy.

## Next

1. Confirm Supabase Auth Site URL + Redirect URLs saved (human).
2. Manual E2E: sign-up → confirm email → sign-in → `/dashboard` → sign-out.
3. Add GitHub Actions deploy on merge to `master`: `npm run build && npx wrangler deploy` with repository secret `CLOUDFLARE_API_TOKEN` (and account id if required).
4. Optional: script the `legacy_env` strip into a `predeploy` npm script.
