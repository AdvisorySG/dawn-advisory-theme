# search-sync — Ghost → Typesense sync server

A small Hono HTTP server that keeps the Typesense `ghost` collection in sync with the Ghost site. Uses webhooks (`POST /webhook`) and `POST /sync` to trigger partial and full indexing on demand.

## Endpoints

- `POST /webhook?secret=…` — Ghost webhook receiver (upsert/delete one post).
- `POST /sync?secret=…` — full reconcile of the whole collection.
- `GET /healthz` — liveness.

## Local development

```bash
npm install
npm test         # vitest
npm run dev      # tsx watch (needs env vars set; see .env.example)
```

## Schema (one-time, unchanged)

Ensure the typesense instance is set up with the ghost docs. See [https://github.com/magicpages/ghost-typesense](https://github.com/magicpages/ghost-typesense)

## Deploy

1. Copy this `search-sync/` directory to the vm (or `git pull` it).
2. Append the contents of `docker-compose.yml` to the main docker compose file on the server. In this case, it was `~/dockerfiles/swag/compose.yml`
3. Run `docker compose up -d`
4. Check status with `docker ps`
5. Add a SWAG/nginx proxy config for `sync.advisory.sg` that forwards to the
   sync service on port `8080`.
6. Create a DNS A record: `sync.advisory.sg` → the Lightsail public IP.
7. `cp .env.example .env` and fill in real values.
8. Build and start: `docker compose up -d --build`.
9. Reload SWAG/nginx so the new route + certificate take effect.

## Register Ghost webhooks

In Ghost Admin → Settings → Integrations → your custom integration → add a
webhook for **each** event, all targeting:

`https://sync.advisory.sg/webhook?secret=<WEBHOOK_SECRET>`

Events: `Post published`, `Post updated`, `Post unpublished`, `Post deleted`.

## Verify

1. Edit a post in Ghost → `docker compose logs -f sync` shows `synced {action:'upsert'...}`.
2. Confirm via a Typesense search.
3. Trigger a reconcile: `curl -X POST "https://sync.advisory.sg/sync?secret=<WEBHOOK_SECRET>"` → `{ "indexed": N, "deleted": M }`.
