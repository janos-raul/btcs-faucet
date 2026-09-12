const cron = require('node-cron');
const config = require('../config');
const logger = require('../utils/logger');
const taService = require('../services/taService');

function startScheduler(client) {
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

module.exports = { startScheduler };
