const path = require('node:path');
const fs = require('node:fs');
const config = require('./config');

// Dependency-free JSON-file store instead of node:sqlite (which needs
// Node >= 22.5): this keeps the faucet deployable on whatever Node version
// the host already runs for other apps, no native/optional deps either.
// Node is single-threaded and every mutation here is synchronous with no
// awaits in between, so reserveClaim's check-then-insert is just as atomic
// as a SQLite transaction would be - nothing can interleave.

fs.mkdirSync(path.dirname(config.db.path), { recursive: true });

let nextId = 1;
let claims = [];

if (fs.existsSync(config.db.path)) {
  const raw = JSON.parse(fs.readFileSync(config.db.path, 'utf8'));
  nextId = raw.nextId || 1;
  claims = raw.claims || [];
}

function persist() {
  const tmpPath = `${config.db.path}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify({ nextId, claims }));
  fs.renameSync(tmpPath, config.db.path); // atomic on POSIX, avoids a torn file on crash mid-write
}

/**
 * Checks the cooldown window and, if clear, reserves a pending claim.
 * 'pending' rows must count too, not just 'sent': two near-simultaneous
 * claims each run their synchronous reserve-check before either has
 * finished the async RPC call that would flip it to 'sent', so checking
 * only 'sent' would let both through. A 'failed' claim intentionally does
 * NOT block - it frees the cooldown slot for a retry.
 *
 * Returns { allowed: true, claimId } or { allowed: false, retryAfterMs }.
 */
function reserveClaim(discordUserId, address, cooldownMs) {
  const cutoff = Date.now() - cooldownMs;

  let mostRecentBlocking = null;
  for (const c of claims) {
    if (
      (c.status === 'sent' || c.status === 'pending') &&
      c.createdAt > cutoff &&
      (c.discordUserId === discordUserId || c.address === address) &&
      (!mostRecentBlocking || c.createdAt > mostRecentBlocking.createdAt)
    ) {
      mostRecentBlocking = c;
    }
  }

  if (mostRecentBlocking) {
    const retryAfterMs = mostRecentBlocking.createdAt + cooldownMs - Date.now();
    return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 0) };
  }

  const claim = {
    id: nextId++,
    discordUserId,
    address,
    amount: null,
    txid: null,
    status: 'pending',
    createdAt: Date.now(),
  };
  claims.push(claim);
  persist();
  return { allowed: true, claimId: claim.id };
}

function markClaimSent(claimId, amount, txid) {
  const claim = claims.find((c) => c.id === claimId);
  claim.amount = amount;
  claim.txid = txid;
  claim.status = 'sent';
  persist();
}

function markClaimFailed(claimId) {
  const claim = claims.find((c) => c.id === claimId);
  claim.status = 'failed';
  persist();
}

function close() {
  // Every mutation persists synchronously already; nothing to flush.
}

module.exports = { reserveClaim, markClaimSent, markClaimFailed, close };
