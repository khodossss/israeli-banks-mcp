# kesef relay (Cloudflare Worker)

Zero-knowledge store for family snapshots. It holds only the per-room verifier and
end-to-end encrypted blobs — it can never read your transactions.

kesef clients use the maintainer's deployment (`DEFAULT_RELAY_URL` in `config.mjs`) unless
`RELAY_URL` is set. Deploy your own if you'd rather not depend on it.

## Deploy once

1. `npm i -g wrangler`, then `wrangler login`.
2. `wrangler kv namespace create ROOMS` → copy the `id` into `wrangler.toml`.
3. `wrangler deploy` → note the `https://kesef-relay.<you>.workers.dev` URL.
4. Put that URL in `RELAY_URL` in every family member's `.env`.

## Local test

`wrangler dev`, then point `RELAY_URL` at `http://127.0.0.1:8787`.

## What it stores

- `room:<hid>:verifier` — HMAC of the token secret (cannot decrypt).
- `room:<hid>:member:<mid>` — AES-256-GCM sealed snapshot, max 5 MB.
