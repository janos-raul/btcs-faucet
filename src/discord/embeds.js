const { EmbedBuilder } = require('discord.js');
const config = require('../config');
const rpc = require('../rpc');
const logger = require('../utils/logger');

/**
 * @param {{ includeBalance?: boolean }} options - includeBalance defaults to
 *   false because this embed is also used for the pinned channel intro
 *   (src/discord/commands/setupIntro.js), which isn't refreshed automatically.
 *   A live balance snapshot left pinned would go stale the moment the faucet
 *   pays out again, so only opt in for commands that render it fresh each time.
 */
async function buildFaucetInfoEmbed({ includeBalance = false } = {}) {
  const embed = new EmbedBuilder()
    .setTitle('BTCS Faucet')
    .setDescription('Get free BTCS to try things out.')
    .addFields(
      { name: 'How to claim', value: '`/faucet address:<your BTCS address>`' },
      {
        name: 'Limit',
        value: `Once per Discord account **and** once per address every **${config.faucet.cooldownHours}h**`,
      },
      { name: 'Confirmation', value: 'Blocks confirm in ~5 minutes, so give your claim a few minutes to land.' }
    )
    .setColor(0xf7931a);

  if (includeBalance) {
    let balanceLine = 'Unavailable right now';
    try {
      const balance = await rpc.getBalance();
      balanceLine = `${balance} BTCS`;
    } catch (err) {
      logger.warn('Failed to fetch faucet balance for embed:', err.message);
    }
    embed.addFields({ name: 'Faucet balance', value: balanceLine, inline: true });
  }

  if (config.faucet.topupAddress) {
    embed.addFields({
      name: 'Help refill the faucet',
      value: `\`${config.faucet.topupAddress}\``,
    });
  }

  return embed;
}

module.exports = { buildFaucetInfoEmbed };
