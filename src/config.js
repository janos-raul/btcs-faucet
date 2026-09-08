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
  db: {
    path: process.env.DATABASE_PATH || './data/faucet.db',
  },
};
