// Lightweight in-memory per-key throttle, separate from the 24h claim
// cooldown in db.js. Deliberately NOT persisted - losing this on restart is
// fine, it only exists to cap how fast one Discord user can trigger repeated
// /faucet attempts (each of which may cost an RPC round-trip even when it
// fails, e.g. a well-formed but nonexistent address), not to enforce the
// actual anti-double-spend guarantee.
const lastAttemptAt = new Map();

/**
 * @returns { allowed: true } or { allowed: false, retryAfterMs }
 */
function checkAndRecordAttempt(key, minIntervalMs) {
  const now = Date.now();
  const last = lastAttemptAt.get(key);

  if (last !== undefined) {
    const elapsed = now - last;
    if (elapsed < minIntervalMs) {
      return { allowed: false, retryAfterMs: minIntervalMs - elapsed };
    }
  }

  // Only recorded on allowed attempts - otherwise a user hammering the
  // command would keep pushing their own eligibility back indefinitely.
  lastAttemptAt.set(key, now);
  return { allowed: true };
}

module.exports = { checkAndRecordAttempt };
