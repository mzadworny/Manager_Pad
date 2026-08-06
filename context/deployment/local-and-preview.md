# Local env vs workers.dev

Short reference for running Manager Pad on your machine and deciding when to hit production Workers.

## See the app locally

```bash
nvm use          # Node from .nvmrc (22.23.1)
npm ci           # if deps not installed
# Ensure .dev.vars has SUPABASE_URL + SUPABASE_KEY (copy from .env.example)
npm run dev      # http://localhost:4321 — day-to-day iteration
```

Production-like check (same workerd runtime as deploy):

```bash
npm run build && npm run preview   # http://127.0.0.1:4321
```

Supabase Auth already allows `http://localhost:4321/**` — see [deploy-plan.md](./deploy-plan.md).

## When to use which

| Use | When |
| --- | --- |
| `npm run dev` | Daily UI/API work, Cursor on your machine, fast feedback |
| `npm run build && npm run preview` | Catch workerd/SSR/build issues before deploy |
| `workers.dev` (`https://manager-pad.maciejzadworny.workers.dev`) | Smoke the real edge URL, cookie/auth against production Worker secrets, share a link |

Production publish is **manual** today: `npm run build` then `npx wrangler deploy`. CI (`.github/workflows/ci.yml`) only lint/builds — it does not deploy. Deploy friction (including the `legacy_env` strip) is documented in [deploy-plan.md](./deploy-plan.md).

## Vercel-like previews (deferred)

Cloudflare can approximate Vercel preview URLs later (Workers Builds or GitHub Actions + Wrangler). That setup is intentionally skipped for now. When you revisit it, start from the Operational Story in [infrastructure.md](../foundation/infrastructure.md).
