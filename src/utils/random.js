const crypto = require('node:crypto');

const PRECISION = 8; // decimal places, matches typical bitcoind-fork amount precision

/**
 * Uniformly random amount in [min, max], inclusive, at PRECISION decimal
 * places, drawn from a CSPRNG rather than Math.random().
 */
function randomAmount(min, max) {
  if (max <= min) {
    throw new Error(`randomAmount: max (${max}) must be greater than min (${min})`);
  }
  const scale = 10 ** PRECISION;
  const minUnits = Math.round(min * scale);
  const maxUnits = Math.round(max * scale);
  const units = crypto.randomInt(minUnits, maxUnits + 1);
  return units / scale;
}

module.exports = { randomAmount };
