const logger = require('../utils/logger');

function formatChannelName(label, ticker) {
  const arrow = ticker.changePercent >= 0 ? '🟢' : '🔴';
  const sign = ticker.changePercent >= 0 ? '+' : '';
  return `${arrow} ${label}: $${ticker.lastPrice} (${sign}${ticker.changePercent.toFixed(1)}%)`;
}

/**
 * Renames a (typically locked, display-only) voice channel to show the
 * current price. Skips the API call entirely when the name hasn't actually
 * changed, since Discord only allows ~2 channel renames per 10 minutes.
 *
 * @param {import('discord.js').Client} client
 * @param {{ channelId: string, market: string, label: string }} source
 * @param {(market: string) => Promise<{ lastPrice: number, changePercent: number }>} fetchTicker
 */
async function updateTickerChannel(client, source, fetchTicker) {
  const ticker = await fetchTicker(source.market);
  const name = formatChannelName(source.label, ticker);

  const channel = await client.channels.fetch(source.channelId);
  if (!channel) throw new Error(`Price ticker channel ${source.channelId} not found`);

  if (channel.name === name) return;

  await channel.setName(name);
  logger.info(`Updated price ticker channel ${source.channelId} -> "${name}"`);
}

module.exports = { updateTickerChannel };
