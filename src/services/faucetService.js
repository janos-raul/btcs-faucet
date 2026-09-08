const config = require('../config');
const db = require('../db');
const rpc = require('../rpc');
const logger = require('../utils/logger');
const { randomAmount } = require('../utils/random');
const { extractAddress } = require('./addressValidator');
const { RPC_WALLET_INSUFFICIENT_FUNDS } = require('../rpc/errorCodes');
const { checkAndRecordAttempt } = require('./requestThrottle');

const COOLDOWN_MS = config.faucet.cooldownHours * 60 * 60 * 1000;

// Caps how often one Discord user can trigger an attempt (success or
// failure) - independent of the 24h claim cooldown. Without this, a user
// could spam well-formed-but-nonexistent addresses indefinitely: a failed
// attempt frees the cooldown slot by design (see db.js), so nothing else
// would stop rapid repeat RPC round-trips.
const MIN_ATTEMPT_INTERVAL_MS = 5000;

/**
 * @returns one of:
 *   { ok: true, amount, txid }
 *   { ok: false, reason: 'rate_limited', retryAfterMs }
 *   { ok: false, reason: 'invalid_address' }
 *   { ok: false, reason: 'cooldown', retryAfterMs }
 *   { ok: false, reason: 'faucet_empty' }
 *   { ok: false, reason: 'send_failed' }
 */
async function claim(discordUserId, rawAddress) {
  const throttle = checkAndRecordAttempt(discordUserId, MIN_ATTEMPT_INTERVAL_MS);
  if (!throttle.allowed) {
    return { ok: false, reason: 'rate_limited', retryAfterMs: throttle.retryAfterMs };
  }

  // Tolerates extra text around the address (e.g. "here's my address: bc1q... thanks!")
  // rather than requiring an exact match.
  const address = extractAddress(rawAddress);

  if (!address) {
    return { ok: false, reason: 'invalid_address' };
  }

  const reservation = db.reserveClaim(discordUserId, address, COOLDOWN_MS);
  if (!reservation.allowed) {
    return { ok: false, reason: 'cooldown', retryAfterMs: reservation.retryAfterMs };
  }

  const { claimId } = reservation;

  try {
    const isValid = await rpc.validateAddress(address);
    if (!isValid) {
      db.markClaimFailed(claimId);
      return { ok: false, reason: 'invalid_address' };
    }

    const amount = randomAmount(config.faucet.minAmount, config.faucet.maxAmount);
    const txid = await rpc.sendToAddress(address, amount);

    db.markClaimSent(claimId, amount, txid);
    logger.info(`Sent ${amount} BTCS to ${address} for Discord user ${discordUserId} (txid ${txid})`);
    return { ok: true, amount, txid, address };
  } catch (err) {
    db.markClaimFailed(claimId);

    if (err.code === RPC_WALLET_INSUFFICIENT_FUNDS) {
      logger.warn(`Faucet wallet is empty - could not send to ${address} for Discord user ${discordUserId}`);
      return { ok: false, reason: 'faucet_empty' };
    }

    logger.error(`Failed to send funds to ${address} for Discord user ${discordUserId}:`, err);
    return { ok: false, reason: 'send_failed' };
  }
}

module.exports = { claim };
