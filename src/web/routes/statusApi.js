const express = require('express');
const rateLimit = require('express-rate-limit');
const config = require('../../config');
const rpc = require('../../rpc');
const logger = require('../../utils/logger');

const router = express.Router();

// Public, unauthenticated, read-only - just the faucet's current balance and
// its topup address, meant for the /faucet landing page.
const limiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });

router.get('/status', limiter, async (req, res) => {
  let balance = null;
  try {
    balance = await rpc.getBalance();
  } catch (err) {
    logger.warn('Failed to fetch faucet balance for /faucet/status:', err.message);
  }

  res.status(200).json({
    ok: true,
    balance,
    topupAddress: config.faucet.topupAddress || null,
    devFundAddress: config.devFundAddress || null,
    devFundBtcAddress: config.devFundBtcAddress || null,
    devFundBchAddress: config.devFundBchAddress || null,
    minAmount: config.faucet.minAmount,
    maxAmount: config.faucet.maxAmount,
    cooldownHours: config.faucet.cooldownHours,
    webClaimEnabled: Boolean(config.turnstile.siteKey && config.turnstile.secretKey),
    turnstileSiteKey: config.turnstile.siteKey || null,
  });
});

module.exports = router;
