require('dotenv').config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function num(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be a number, got "${value}"`);
  }
  return parsed;
}

const rpcConfigured = Boolean(
  process.env.BTCS_RPC_HOST && process.env.BTCS_RPC_USER && process.env.BTCS_RPC_PASS
);

module.exports = {
  discord: {
    token: required('DISCORD_TOKEN'),
    clientId: required('DISCORD_CLIENT_ID'),
    guildId: process.env.DISCORD_GUILD_ID || null,
  },
  web: {
    port: num('PORT', 3000),
    publicBaseUrl: process.env.PUBLIC_BASE_URL || `http://localhost:${num('PORT', 3000)}`,
  },
  internalApiSecret: required('INTERNAL_API_SECRET'),
  rpc: {
    configured: rpcConfigured,
    host: process.env.BTCS_RPC_HOST || '127.0.0.1',
    port: num('BTCS_RPC_PORT', 8332),
    user: process.env.BTCS_RPC_USER || '',
    pass: process.env.BTCS_RPC_PASS || '',
    wallet: process.env.BTCS_RPC_WALLET || '',
    walletPassphrase: process.env.BTCS_RPC_WALLET_PASSPHRASE || '',
  },
  faucet: {
    minAmount: num('FAUCET_MIN_AMOUNT', 0.6),
    maxAmount: num('FAUCET_MAX_AMOUNT', 1.8),
    cooldownHours: num('FAUCET_COOLDOWN_HOURS', 24),
    topupAddress: process.env.FAUCET_TOPUP_ADDRESS || '',
  },
  // Optional: web-form claiming (see src/web/routes/webClaimApi.js) stays
  // disabled - the form shows a "not available" message - until both of
  // these are set. Deliberately not required() so deploying this feature
  // doesn't crash-loop the app before Cloudflare Turnstile is configured.
  turnstile: {
    siteKey: process.env.TURNSTILE_SITE_KEY || '',
    secretKey: process.env.TURNSTILE_SECRET_KEY || '',
  },
  db: {
    path: process.env.DATABASE_PATH || './data/faucet.json',
  },
  // Optional: shown in /help and on the /faucet page (only when set) for
  // people who want to support development rather than just refill the
  // faucet wallet. The BTC/BCH addresses are web-page-only (kept out of
  // /help to keep the Discord embed short).
  devFundAddress: process.env.DEV_FUND_ADDRESS || '',
  devFundBtcAddress: process.env.DEV_FUND_ADDRESS_BTC || '',
  devFundBchAddress: process.env.DEV_FUND_ADDRESS_BCH || '',
  // Optional: daily technical-analysis post (see src/services/taService.js).
  // Stays disabled - the scheduler and /post-ta command both no-op - until
  // both TA_CHANNEL_ID and ANTHROPIC_API_KEY are set. Deliberately not
  // required() so deploying this feature can't crash-loop the app before
  // it's configured.
  ta: {
    enabled: Boolean(process.env.TA_CHANNEL_ID && process.env.ANTHROPIC_API_KEY),
    channelId: process.env.TA_CHANNEL_ID || '',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    market: process.env.TA_MARKET || 'BTCS_USDC',
    resolutionMinutes: num('TA_RESOLUTION_MINUTES', 15),
    lookbackHours: num('TA_LOOKBACK_HOURS', 48),
    cron: process.env.TA_CRON || '0 9,15 * * *',
  },
};
