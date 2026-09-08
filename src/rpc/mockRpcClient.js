const crypto = require('node:crypto');
const logger = require('../utils/logger');
const { isStructurallyValidAddress } = require('../services/addressValidator');
const { RPC_WALLET_INSUFFICIENT_FUNDS } = require('./errorCodes');

const MOCK_STARTING_BALANCE = 1000;

/**
 * Stand-in for BtcsRpcClient used until real node RPC credentials are
 * configured (see config.rpc.configured). Same interface, no network calls,
 * no real funds move. Lets the whole bot -> API -> "send" flow be exercised
 * end-to-end before a BTCS node is wired up.
 */
class MockRpcClient {
  constructor() {
    this.balance = MOCK_STARTING_BALANCE;
  }

  async validateAddress(address) {
    return isStructurallyValidAddress(address);
  }

  async getBalance() {
    return this.balance;
  }

  async sendToAddress(address, amount) {
    if (amount > this.balance) {
      const err = new Error('Insufficient funds');
      err.code = RPC_WALLET_INSUFFICIENT_FUNDS;
      throw err;
    }

    const txid = crypto.randomBytes(32).toString('hex');
    this.balance -= amount;
    logger.warn(
      `[MOCK RPC] Would send ${amount} BTCS to ${address} (no real BTCS_RPC_* env vars configured). Fake txid: ${txid}`
    );
    return txid;
  }
}

module.exports = MockRpcClient;
