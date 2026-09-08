const config = require('../config');
const logger = require('../utils/logger');
const BtcsRpcClient = require('./btcsRpcClient');
const MockRpcClient = require('./mockRpcClient');

let client;
if (config.rpc.configured) {
  logger.info(`Using live BTCS RPC at ${config.rpc.host}:${config.rpc.port}`);
  client = new BtcsRpcClient(config.rpc);
} else {
  logger.warn('BTCS_RPC_HOST/USER/PASS not set - running with a MOCK RPC client. No real coins will move.');
  client = new MockRpcClient();
}

module.exports = client;
