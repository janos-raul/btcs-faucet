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

pm2 restart btcs-faucet
pm2 save
