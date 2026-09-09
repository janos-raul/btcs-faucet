const express = require('express');
const rateLimit = require('express-rate-limit');
const config = require('../../config');
const faucetService = require('../../services/faucetService');
const logger = require('../../utils/logger');

const router = express.Router();

// Public, unauthenticated - anyone on the internet can hit this, unlike
// /api/claim (loopback-only, HMAC-signed, called only by our own Discord
// bot). The abuse controls here are a Cloudflare Turnstile check (a real
// account-free visitor has no other identity barrier) plus the same
// per-address/per-identity cooldown and throttle faucetService already
// enforces for Discord claims - identity here is "web:<client ip>" instead
// of a Discord user id.
const limiter = rateLimit({ windowMs: 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });

async function verifyTurnstile(token, remoteIp) {
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret: config.turnstile.secretKey, response: token, remoteip: remoteIp }),
  });
  const data = await res.json().catch(() => null);
  return Boolean(data && data.success);
}

router.post('/claim', limiter, express.json({ limit: '2kb' }), async (req, res) => {
  if (!config.turnstile.secretKey) {
    return res.status(503).json({ ok: false, reason: 'web_claims_disabled' });
  }

  const { address, turnstileToken } = req.body || {};
  if (!address || !turnstileToken) {
    return res.status(400).json({ ok: false, reason: 'bad_request' });
  }

  let captchaOk;
  try {
    captchaOk = await verifyTurnstile(turnstileToken, req.ip);
  } catch (err) {
    logger.error('Turnstile verification request failed:', err);
    return res.status(502).json({ ok: false, reason: 'captcha_unavailable' });
  }
  if (!captchaOk) {
    return res.status(400).json({ ok: false, reason: 'captcha_failed' });
  }

  const identityKey = `web:${req.ip}`;
  const result = await faucetService.claim(identityKey, address);

  if (result.ok) return res.status(200).json(result);
  if (result.reason === 'cooldown') return res.status(429).json(result);
  if (result.reason === 'rate_limited') return res.status(429).json(result);
  if (result.reason === 'invalid_address') return res.status(400).json(result);
  if (result.reason === 'placeholder_detected') return res.status(400).json(result);
  if (result.reason === 'faucet_empty') return res.status(503).json(result);
  return res.status(502).json(result);
});

module.exports = router;
