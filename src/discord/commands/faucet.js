const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const config = require('../../config');
const apiClient = require('../apiClient');
const logger = require('../../utils/logger');

function formatDuration(ms) {
  const totalMinutes = Math.ceil(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

const data = new SlashCommandBuilder()
  .setName('faucet')
  .setDescription('Request free BTCS from the faucet')
  .addStringOption((option) =>
    option
      .setName('address')
      .setDescription('Your BTCS wallet address (fine to paste extra text around it)')
      .setRequired(true)
  );

async function execute(interaction) {
  const rawInput = interaction.options.getString('address', true);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  let result;
  try {
    result = await apiClient.requestClaim(interaction.user.id, rawInput);
  } catch (err) {
    logger.error('Faucet API call failed:', err);
    await interaction.editReply('The faucet is unreachable right now. Please try again in a few minutes.');
    return;
  }

  if (result.ok) {
    await interaction.editReply(
      `Sent **${result.amount} BTCS** to \`${result.address}\`.\nTx: \`${result.txid}\`\nBlocks confirm in ~5 minutes.`
    );
    // Public activity announcement in the requesting channel - amount only,
    // no address/txid, so the claimant's wallet isn't tied to their Discord
    // account in public view.
    await interaction.channel
      ?.send(`🎉 <@${interaction.user.id}> claimed **${result.amount} BTCS** from the faucet!`)
      .catch((err) => logger.warn('Failed to post public claim announcement:', err.message));
    return;
  }

  switch (result.reason) {
    case 'rate_limited':
      await interaction.editReply(
        `You're going a bit fast - try again in ${Math.ceil(result.retryAfterMs / 1000)}s.`
      );
      break;
    case 'cooldown':
      await interaction.editReply(
        `You (or that address) already claimed within the last ${config.faucet.cooldownHours}h. Try again in ${formatDuration(
          result.retryAfterMs
        )}.`
      );
      break;
    case 'invalid_address':
      await interaction.editReply(
        "I couldn't find a valid BTCS address in that. Double-check it and try again."
      );
      break;
    case 'faucet_empty':
      await interaction.editReply(
        "The faucet is empty right now - it hasn't been topped up yet. Check back later!"
      );
      break;
    default:
      await interaction.editReply('Something went wrong sending your coins. Please try again shortly.');
  }
}

module.exports = { data, execute };
