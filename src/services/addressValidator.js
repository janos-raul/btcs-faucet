const crypto = require('node:crypto');

// Structural pre-validation only. This module deliberately does NOT hardcode
// BTCS-specific version bytes / bech32 HRP, since those aren't something to
// guess at. It just checks that a string is a well-formed Base58Check or
// Bech32(m) payload (correct checksum). The AUTHORITATIVE check is always
// the node's own `validateaddress` RPC (see rpc/btcsRpcClient.js), which
// knows the real network parameters. This is purely a fast local fail for
// obviously garbage input, and what the mock RPC uses when no node is
// configured yet.

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest();
}

function isBase58Check(address) {
  if (!address || address.length < 26 || address.length > 35) return false;
  if (![...address].every((c) => BASE58_ALPHABET.includes(c))) return false;

  let num = 0n;
  for (const char of address) {
    num = num * 58n + BigInt(BASE58_ALPHABET.indexOf(char));
  }

  let bytes = [];
  while (num > 0n) {
    bytes.unshift(Number(num % 256n));
    num /= 256n;
  }
  for (const char of address) {
    if (char !== '1') break;
    bytes.unshift(0);
  }

  if (bytes.length < 5) return false;
  const payload = Buffer.from(bytes.slice(0, -4));
  const checksum = Buffer.from(bytes.slice(-4));
  const expected = sha256(sha256(payload)).subarray(0, 4);
  return checksum.equals(expected);
}

const BECH32_ALPHABET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const BECH32_GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

function bech32Polymod(values) {
  let chk = 1;
  for (const v of values) {
    const top = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) {
      if ((top >>> i) & 1) chk ^= BECH32_GENERATOR[i];
    }
  }
  return chk >>> 0;
}

function bech32HrpExpand(hrp) {
  const out = [];
  for (const c of hrp) out.push(c.charCodeAt(0) >> 5);
  out.push(0);
  for (const c of hrp) out.push(c.charCodeAt(0) & 31);
  return out;
}

function isBech32(address) {
  if (!address || address.length < 8 || address.length > 90) return false;
  if (address !== address.toLowerCase() && address !== address.toUpperCase()) return false;
  const lower = address.toLowerCase();

  const sep = lower.lastIndexOf('1');
  if (sep < 1 || sep + 7 > lower.length) return false;
  const hrp = lower.slice(0, sep);
  const data = lower.slice(sep + 1);
  if (![...data].every((c) => BECH32_ALPHABET.includes(c))) return false;

  const values = [...data].map((c) => BECH32_ALPHABET.indexOf(c));
  const polymod = bech32Polymod([...bech32HrpExpand(hrp), ...values]);
  // 1 = bech32 (BIP-173), 0x2bc830a3 = bech32m (BIP-350, used by segwit v1+)
  return polymod === 1 || polymod === 0x2bc830a3;
}

function isStructurallyValidAddress(address) {
  if (typeof address !== 'string') return false;
  const trimmed = address.trim();
  if (!trimmed) return false;
  return isBase58Check(trimmed) || isBech32(trimmed);
}

/**
 * Pulls a structurally-valid address out of arbitrary surrounding text, e.g.
 * "here's my address: bc1qxyz... thanks!" -> "bc1qxyz...". Both Base58Check
 * and Bech32(m) addresses are purely alphanumeric, so splitting on
 * non-alphanumeric runs is enough to isolate candidate tokens. Returns the
 * first valid one, or null if none is found.
 */
function extractAddress(text) {
  if (typeof text !== 'string') return null;
  const candidates = text.match(/[a-zA-Z0-9]+/g) || [];
  return candidates.find((candidate) => isStructurallyValidAddress(candidate)) || null;
}

module.exports = { isStructurallyValidAddress, extractAddress };
