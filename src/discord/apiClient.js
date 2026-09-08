const config = require('../config');
const hmac = require('../security/hmac');

// Talks to our own faucet API over loopback. Kept as a real signed HTTP call
// (rather than calling faucetService directly in-process) so the bot and
// the web server stay decoupled and could be split into separate deployments
// later without touching this file - only the base URL would change.
const INTERNAL_API_BASE_URL = `http://127.0.0.1:${config.web.port}`;

async function requestClaim(discordUserId, address) {
  const { body, headers } = hmac.sign(config.internalApiSecret, { discordUserId, address });

  const res = await fetch(`${INTERNAL_API_BASE_URL}/api/claim`, {
    method: 'POST',
    headers,
    body,
  });

  const result = await res.json().catch(() => ({ ok: false, reason: 'bad_response' }));
  return result;
}

module.exports = { requestClaim };
