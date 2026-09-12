const logger = require('../utils/logger');

function formatChannelName(label, ticker) {
  const arrow = ticker.changePercent >= 0 ? '🟢' : '🔴';
  const sign = ticker.changePercent >= 0 ? '+' : '';
  return `${arrow} ${label}: $${ticker.lastPrice} (${sign}${ticker.changePercent.toFixed(1)}%)`;
}

/**
 * Renames a channel (a locked voice channel, or a category - both allow
 * free-form names, unlike text channels) to show the current price. Skips
 * the API call entirely when the name hasn't actually changed, since
 * Discord only allows ~2 channel renames per 10 minutes.
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

  if (channel.name !== name) {
    await channel.setName(name);
    logger.info(`Updated price ticker channel ${source.channelId} -> "${name}"`);
  }

  // Pins it above the other channels in its category (or at the server's
  // top level if uncategorized) - avoids fighting Discord's drag-and-drop
  // ordering by hand, and self-heals if something ever bumps it out of
  // place. No-op once it's already there.
  if (channel.position !== 0) {
    await channel.setPosition(0);
    logger.info(`Repositioned price ticker channel ${source.channelId} to the top`);
  }
}

module.exports = { updateTickerChannel };
