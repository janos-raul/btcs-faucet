const logger = require('../utils/logger');

/**
 * Minimal JSON-RPC client for a bitcoind-compatible daemon (which is what
 * BTCS, as a Bitcoin fork, is expected to expose). Only the methods the
 * faucet needs are wrapped.
 */
class BtcsRpcClient {
  constructor({ host, port, user, pass, wallet, walletPassphrase }) {
    const path = wallet ? `/wallet/${encodeURIComponent(wallet)}` : '/';
    this.url = `http://${host}:${port}${path}`;
    this.authHeader = `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
    this.walletPassphrase = walletPassphrase;
  }

  async call(method, params = []) {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: this.authHeader,
      },
      body: JSON.stringify({ jsonrpc: '1.0', id: 'btcs-faucet', method, params }),
    });

    const payload = await res.json().catch(() => null);
    if (!res.ok && !payload) {
      throw new Error(`RPC ${method} failed with HTTP ${res.status}`);
    }
    if (payload?.error) {
      const err = new Error(`RPC ${method} error: ${payload.error.message || JSON.stringify(payload.error)}`);
      err.code = payload.error.code;
      throw err;
    }
    return payload.result;
  }

  /** Authoritative address validity check - defers to the node's own rules. */
  async validateAddress(address) {
    const result = await this.call('validateaddress', [address]);
    return Boolean(result && result.isvalid);
  }

  async getBalance() {
    return this.call('getbalance');
  }

  async sendToAddress(address, amount) {
    if (this.walletPassphrase) {
      // Unlock just long enough to send; ignore "already unlocked" errors.
      await this.call('walletpassphrase', [this.walletPassphrase, 30]).catch((err) => {
        logger.warn('walletpassphrase call failed (wallet may already be unlocked):', err.message);
      });
    }
    return this.call('sendtoaddress', [address, amount]);
  }
}

module.exports = BtcsRpcClient;
