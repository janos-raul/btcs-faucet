const { EmbedBuilder } = require('discord.js');
const config = require('../config');
const rpc = require('../rpc');
const logger = require('../utils/logger');

/**
 * @param {{ includeBalance?: boolean }} options - includeBalance defaults to
 *   false and does one extra RPC round-trip when true. Callers that render
 *   this embed fresh each time (e.g. /help) should pass true; be cautious
 *   opting in anywhere the result might sit around unrefreshed (e.g. pinned
 *   in a channel) since the balance will go stale as soon as the faucet
 *   pays out again.
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
