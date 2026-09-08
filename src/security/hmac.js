const crypto = require('node:crypto');

const MAX_AGE_MS = 2 * 60 * 1000; // reject requests signed more than 2 minutes ago

function computeSignature(secret, timestamp, body) {
  return crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');
}

/** Sign a JSON-serializable payload. Returns headers to attach to the request. */
function sign(secret, payload) {
  const body = JSON.stringify(payload);
  const timestamp = Date.now().toString();
  const signature = computeSignature(secret, timestamp, body);
  return {
    body,
    headers: {
      'content-type': 'application/json',
      'x-faucet-timestamp': timestamp,
      'x-faucet-signature': signature,
    },
  };
}

/**
 * Verify a raw request body against the timestamp/signature headers.
 * Returns { valid: boolean, reason?: string }.
 */
function verify(secret, rawBody, timestamp, signature) {
  if (!timestamp || !signature) {
    return { valid: false, reason: 'missing_signature_headers' };
  }

  const age = Date.now() - Number(timestamp);
  if (!Number.isFinite(age) || age < -MAX_AGE_MS || age > MAX_AGE_MS) {
    return { valid: false, reason: 'stale_timestamp' };
  }

  const expected = computeSignature(secret, timestamp, rawBody);
  const expectedBuf = Buffer.from(expected, 'hex');
  const actualBuf = Buffer.from(signature, 'hex');
  if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
    return { valid: false, reason: 'bad_signature' };
  }

  return { valid: true };
}

module.exports = { sign, verify };
