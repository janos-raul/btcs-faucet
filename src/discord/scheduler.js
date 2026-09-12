const cron = require('node-cron');
const config = require('../config');
const logger = require('../utils/logger');
const taService = require('../services/taService');
const nonkycClient = require('../services/nonkycClient');
const nestexClient = require('../services/nestexClient');
const { updateTickerChannel } = require('../services/priceTickerService');

function startTaScheduler(client) {
  if (!config.ta.enabled) return;

  cron.schedule(
    config.ta.cron,
    () => {
      taService.postDailyUpdate(client).catch((err) => {
        logger.error('Scheduled TA post failed:', err);
      });
    },
    { timezone: 'UTC' }
  );

  logger.info(`TA scheduler started (cron "${config.ta.cron}" UTC, channel ${config.ta.channelId})`);
}

function startPriceTickers(client) {
  const sources = [
    ['NonKYC', config.priceTicker.nonkyc, nonkycClient.getTicker],
    ['NestEx', config.priceTicker.nestex, nestexClient.getTicker],
  ].filter(([, source]) => source.enabled);

  if (sources.length === 0) return;

  for (const [name, source, fetchTicker] of sources) {
    const run = () =>
      updateTickerChannel(client, source, fetchTicker).catch((err) => {
        logger.error(`${name} price ticker update failed:`, err);
      });

    cron.schedule(config.priceTicker.cron, run, { timezone: 'UTC' });
    run(); // populate immediately instead of waiting for the first tick

    logger.info(`Price ticker started for ${name} (channel ${source.channelId}, cron "${config.priceTicker.cron}" UTC)`);
  }
}

function startScheduler(client) {
  startTaScheduler(client);
  startPriceTickers(client);
}

module.exports = { startScheduler };
