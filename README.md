# btcs-faucet

Discord slash-command faucet for Bitcoin Silver (BTCS). Users run `/faucet address:<their address>`
in Discord; the bot signs the request and sends it to this app's internal API, which validates the
address, enforces a cooldown, and (once a real node is configured) sends a random amount of BTCS
(0.6-1.8 by default) via RPC.

## Commands

- `/faucet address:<...>` - claim coins. The address field tolerates extra text around it (e.g.
  "here's my address: bc1q... thanks!") - it extracts the first alphanumeric token that's a
  structurally valid address, rather than requiring an exact match.
- `/help` - posts the usage/amount/cooldown info as an ephemeral embed, including the faucet's
  **current balance** (queried live from the node) and its topup address if `FAUCET_TOPUP_ADDRESS`
  is set.
- `/faucet-setup` (admin only, requires Manage Server) - posts that same embed, balance included,
  into the current channel and pins it, unpinning any previous copy the bot posted. Since the pinned
  copy isn't refreshed automatically, re-run it whenever you want the balance (or the amount/cooldown
  text, after changing `FAUCET_MIN_AMOUNT`/`FAUCET_MAX_AMOUNT`/`FAUCET_COOLDOWN_HOURS`) updated. Needs
  the bot to have Send Messages and Manage Messages permissions in that channel.

The public `/faucet` page also shows the live balance and topup address (via `GET /faucet/status`,
unauthenticated/read-only - deliberately under `/faucet`, not `/api`, so it's covered by the same
nginx location as the page itself; see the deployment note below).

## Claiming from the web page

The `/faucet` page can also let visitors claim directly (`POST /faucet/claim`), no Discord account
needed - gated by a [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/) check
instead of Discord's own account-creation friction. It's off by default and stays off until both
`TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` are set (see `.env.example` for where to get them) -
the page shows a "not available yet" message in the meantime rather than a broken form.

Once enabled, a web claim runs through the exact same `faucetService.claim()` used by Discord - same
amount range, same address validation, same anti-spam throttle - just keyed by `web:<client IP>`
instead of a Discord user id. The per-*address* 24h cooldown still applies globally regardless of
which path was used, so claiming an address once via Discord blocks a web claim to that same address
too, and vice versa. IP-based identity is coarser than Discord's (multiple people behind the same
NAT/VPN share one cooldown slot) - the CAPTCHA is the main abuse control here, not the IP keying.

## Architecture

Single Node.js process, two logical halves talking over a signed loopback API (so they could be
split into separate deployments later without changing either side's code):

- **Discord bot** (`src/discord/`) - registers `/faucet`, collects the address, HMAC-signs the
  request and POSTs it to the local API.
- **Web server** (`src/web/`) - Express app. `POST /api/claim` is the signed endpoint the bot calls;
  `GET /faucet` serves a small static info page (meant to be reverse-proxied at
  `bitcoinsilver.eu/faucet`).
- **Faucet service** (`src/services/faucetService.js`) - validation, cooldown enforcement, and
  dispatch to the RPC client. Cooldown + double-spend protection is done with a synchronous SQLite
  transaction (`src/db.js`) so two concurrent claims for the same user/address can't both succeed.
- **RPC client** (`src/rpc/`) - talks to a bitcoind-compatible node. If `BTCS_RPC_HOST` /
  `BTCS_RPC_USER` / `BTCS_RPC_PASS` aren't set, a mock client is used automatically: it logs what it
  would have sent and returns a fake txid, so the whole flow can be exercised before a real node is
  wired up.

Storage is a small dependency-free JSON file at `DATABASE_PATH` (see `src/db.js`) rather than a real
database - deliberately, so the app runs on whatever Node version is already on the host with no
native/optional deps. Fine for faucet-scale claim volume; the file is rewritten atomically
(write-temp-then-rename) on every claim.

## Setup

1. **Create the Discord application**: https://discord.com/developers/applications -> New
   Application -> Bot tab -> reset/copy the token. Under OAuth2 -> URL Generator, pick the
   `applications.commands` and `bot` scopes, and under Bot Permissions pick **Send Messages** and
   **Manage Messages** (needed for `/faucet-setup` to post and pin), then use the generated link to
   invite it to your server.

2. Install dependencies:
   ```
   npm install
   ```

3. Copy `.env.example` to `.env` and fill in:
   - `DISCORD_TOKEN`, `DISCORD_CLIENT_ID` (and `DISCORD_GUILD_ID` for instant command updates
     during development - omit it for a global command, which takes up to ~1h to propagate).
   - `INTERNAL_API_SECRET` - generate with
     `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
   - Leave `BTCS_RPC_*` empty to run in mock mode. Fill them in once a BTCS node with RPC enabled
     is reachable.

4. Register the slash commands (`/faucet`, `/help`, `/faucet-setup`):
   ```
   npm run deploy-commands
   ```

5. Start the app:
   ```
   npm start
   ```

## Deploying at bitcoinsilver.eu/faucet

Run this process behind a reverse proxy (nginx/Caddy) that terminates TLS for `bitcoinsilver.eu`
and forwards **only `/faucet`** (the info page, `GET /faucet/status`, and - if enabled -
`POST /faucet/claim`) to this app's `PORT`. **`/api/claim` is not proxied publicly at all** - it's
only ever called by this app's own Discord bot process over loopback (127.0.0.1), gated by the HMAC
signature regardless. The app itself binds to `127.0.0.1` too (see `src/web/server.js`), so it's
unreachable directly even if the host firewall were ever misconfigured.

The app trusts `X-Forwarded-For` from exactly one hop (`app.set('trust proxy', 'loopback')`) so
`req.ip` reflects the real visitor for the web-claim identity/rate-limiting - correct as long as
nginx (or whatever reverse proxy) is the only thing between the app and the internet, on the same
host. If you ever put another proxy/load balancer in front of nginx, this setting needs revisiting.

### Continuous deployment

`.github/workflows/deploy.yml` deploys on every push to `master` (and via manual
`workflow_dispatch`), by SSHing into the server and running `deploy.sh`, which does a `git fetch` +
`git reset --hard origin/master` + `npm install --omit=dev` + `pm2 restart btcs-faucet`. It never
touches `.env`, `data/`, or `node_modules/` - all gitignored/untracked, so a hard reset leaves them
alone.

The SSH key used for this (`DEPLOY_SSH_KEY` secret) is a dedicated key, not a personal one, and is
restricted server-side via a forced command in `authorized_keys`:

```
command="/home/btcwallet/btcs-faucet/deploy.sh",no-port-forwarding,no-X11-forwarding,no-agent-forwarding,no-pty ssh-ed25519 AAAA... github-actions-deploy-btcs-faucet
```

So even if the key ever leaked, it can only ever run that one script - no interactive shell, no
other commands, no port/agent forwarding.

Required repo secrets (Settings -> Secrets and variables -> Actions):

| Secret | Value |
| --- | --- |
| `DEPLOY_SSH_HOST` | Server hostname/IP |
| `DEPLOY_SSH_USER` | `btcwallet` |
| `DEPLOY_SSH_KEY` | The deploy key's private key (PEM) |

## Notes on address validation

The faucet never hardcodes BTCS's specific address version bytes / bech32 prefix - it does a
generic Base58Check / Bech32(m) structural check locally (fast rejection of garbage input) and then
defers to the connected node's own `validateaddress` RPC as the authoritative check before sending
any funds.

## Faucet rules

- Amount: random, uniform between `FAUCET_MIN_AMOUNT` and `FAUCET_MAX_AMOUNT` (default 0.6-1.8 BTCS).
- Cooldown: `FAUCET_COOLDOWN_HOURS` (default 24h), enforced per Discord user ID **and** per
  destination address - whichever was used more recently blocks the claim.
