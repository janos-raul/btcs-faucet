const express = require('express');
const rateLimit = require('express-rate-limit');
const config = require('../../config');
const hmac = require('../../security/hmac');
const faucetService = require('../../services/faucetService');
const logger = require('../../utils/logger');

const router = express.Router();

// This route is meant to be called only by our own Discord bot process
// (over localhost, or an internal network in a split deployment) and is
// gated by an HMAC signature - see security/hmac.js. The rate limit here is
// defense in depth, not the primary anti-abuse control (that's the 24h
// cooldown enforced in faucetService/db).
const limiter = rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });

router.post(
  '/claim',
  limiter,
  express.raw({ type: '*/*', limit: '10kb' }),
  async (req, res) => {
    const rawBody = req.body.toString('utf8');
    const timestamp = req.header('x-faucet-timestamp');
    const signature = req.header('x-faucet-signature');

    const verification = hmac.verify(config.internalApiSecret, rawBody, timestamp, signature);
    if (!verification.valid) {
      logger.warn(`Rejected /api/claim request: ${verification.reason}`);
      return res.status(401).json({ ok: false, reason: 'unauthorized' });
    }

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return res.status(400).json({ ok: false, reason: 'bad_request' });
    }

    const { discordUserId, address } = payload || {};
    if (!discordUserId || !address) {
      return res.status(400).json({ ok: false, reason: 'bad_request' });
    }

    const result = await faucetService.claim(discordUserId, address);

    if (result.ok) return res.status(200).json(result);
    if (result.reason === 'cooldown') return res.status(429).json(result);
    if (result.reason === 'rate_limited') return res.status(429).json(result);
    if (result.reason === 'invalid_address') return res.status(400).json(result);
    if (result.reason === 'placeholder_detected') return res.status(400).json(result);
    if (result.reason === 'faucet_empty') return res.status(503).json(result);
    return res.status(502).json(result);
  }
);

module.exports = router;
