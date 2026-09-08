const config = require('./config');
const logger = require('./utils/logger');
const db = require('./db');
const webServer = require('./web/server');
const bot = require('./discord/bot');

const httpServer = webServer.start();
logger.info(`Faucet web server listening on port ${config.web.port} (public: ${config.web.publicBaseUrl})`);

const discordClient = bot.start();

function shutdown(signal) {
  logger.info(`Received ${signal}, shutting down...`);
  httpServer.close();
  discordClient.destroy();
  db.close();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
