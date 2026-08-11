# Local env vs workers.dev

Short reference for running Manager Pad on your machine and deciding when to hit production Workers.

## See the app locally

```bash
nvm use          # Node from .nvmrc (22.23.1)
npm ci           # if deps not installed
# Ensure .env and .dev.vars have matching SUPABASE_URL + SUPABASE_KEY
npm run dev      # http://localhost:4321 — day-to-day iteration
```

Production-like check (same workerd runtime as deploy):

```bash
npm run build && npm run preview   # http://127.0.0.1:4321
```

Supabase Auth already allows `http://localhost:4321/**` — see [deploy-plan.md](./deploy-plan.md).

## Supabase target (cloud vs local Docker)

The app reads **one** pair of vars: `SUPABASE_URL` and `SUPABASE_KEY`. There is no runtime switcher. Whichever values sit in the env files are what `npm run dev` / `preview` use.

**Default for this project: cloud Supabase** (project `tgtlhokduherbfkycoxh`). Keep cloud credentials in both `.env` and `.dev.vars`. Do **not** start Docker unless the user asks for local Supabase or those files point at `127.0.0.1`.

| Target | `SUPABASE_URL` | `SUPABASE_KEY` | Docker? |
| --- | --- | --- | --- |
| Cloud (default) | `https://<project-ref>.supabase.co` | Dashboard **anon** / **publishable** key | No |
| Local Docker | `http://127.0.0.1:54321` | Anon key printed by `npx supabase start` | Yes — Desktop must be running |

### Which files hold credentials

| File | Used by | Notes |
| --- | --- | --- |
| `.dev.vars` | `npm run dev`, `build`, `preview` (Cloudflare / Wrangler) | **Required** for day-to-day local work |
| `.env` | Astro / tooling that reads Node env; keep in sync with `.dev.vars` | Same two keys; never commit |
| Worker secrets | Production `workers.dev` | Set once via `wrangler secret put`; independent of local files |
| GitHub Actions secrets | CI `lint` + `build` only | Same cloud values; does not deploy |

Optional personal copies (gitignored): `.dev.vars.cloud` / `.dev.vars.local` — swap into `.dev.vars` when you intentionally change target. Do not commit them.

### When to use local Docker instead of cloud

Stay on cloud for normal UI/API work. Use local (`npx supabase start`) when you want a **disposable database**: try migrations/RLS, reset with `npx supabase db reset`, or avoid mixing experiment data with the shared cloud project. Local is not required to “preview before Cloudflare” — `npm run preview` and workers.dev already do that against whatever DB your secrets point at.

Schema to the **cloud** project still goes through `npx supabase db push` (linked remote). Local Docker does not update production tables until you push.

## Dashboard values — what matters for Manager Pad

From the Supabase project settings, **only two values** go into `.env` / `.dev.vars` / Worker secrets:

| Dashboard item | Put in env? | Maps to |
| --- | --- | --- |
| **Project URL** | Yes | `SUPABASE_URL` |
| **anon** / **publishable** key (Auth API keys) | Yes | `SUPABASE_KEY` |
| REST URL, GraphQL URL, Edge Functions URL | No | Derived from Project URL; unused by this app |
| Database URL (`postgresql://…`) | No | Used by Supabase CLI / SQL clients, not by the Astro app |
| **service_role** / **secret** key | No — never in the app or client | Admin-only; bypasses RLS. Do not put in `.dev.vars` |
| Storage URL / access key / secret / region | No | No Storage usage in this app yet |

Newer Supabase UI labels: **publishable** ≈ legacy **anon**; **secret** ≈ legacy **service_role**. This codebase still uses the env name `SUPABASE_KEY` and expects the **publishable/anon** key.

Example (cloud):

```
SUPABASE_URL=https://tgtlhokduherbfkycoxh.supabase.co
SUPABASE_KEY=<anon-or-publishable-key>
```

Keep the same two lines in both `.env` and `.dev.vars`.

## When to use which app surface

| Use | When |
| --- | --- |
| `npm run dev` | Daily UI/API work, Cursor on your machine, fast feedback |
| `npm run build && npm run preview` | Catch workerd/SSR/build issues before deploy |
| `workers.dev` (`https://manager-pad.maciejzadworny.workers.dev`) | Smoke the real edge URL, cookie/auth against production Worker secrets, share a link |

Production publish is **manual** today: `npm run build` then `npx wrangler deploy`. CI (`.github/workflows/ci.yml`) only lint/builds — it does not deploy. Deploy friction (including the `legacy_env` strip) is documented in [deploy-plan.md](./deploy-plan.md).

## Vercel-like previews (deferred)

Cloudflare can approximate Vercel preview URLs later (Workers Builds or GitHub Actions + Wrangler). That setup is intentionally skipped for now. When you revisit it, start from the Operational Story in [infrastructure.md](../foundation/infrastructure.md).
