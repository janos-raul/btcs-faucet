#!/usr/bin/env bash
# Run on the server (via the restricted GitHub Actions deploy key - see
# README's Deployment section). Pulls the latest master and restarts pm2.
# Never touches .env, data/, or node_modules/ - all untracked/gitignored,
# so `git reset --hard` leaves them alone.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

git fetch origin
git reset --hard origin/master

npm install --omit=dev --no-fund --no-audit

# Re-register slash commands (idempotent bulk overwrite - safe to run every
# deploy) so new/changed commands show up without a manual step. Uses the
# DISCORD_TOKEN/CLIENT_ID already in .env - no extra permissions needed.
# Non-fatal: a transient Discord API hiccup here shouldn't block restarting
# the app itself.
npm run deploy-commands || echo "WARNING: slash command registration failed - run 'npm run deploy-commands' manually" >&2

pm2 restart btcs-faucet
pm2 save
