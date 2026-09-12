const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const config = require('../../config');
const logger = require('../../utils/logger');
const taService = require('../../services/taService');

const data = new SlashCommandBuilder()
  .setName('post-ta')
  .setDescription('Post a technical-analysis update now (admin only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

async function execute(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!config.ta.enabled) {
    await interaction.editReply(
      'The TA feature is not configured yet - set TA_CHANNEL_ID and ANTHROPIC_API_KEY to enable it.'
    );
    return;
  }

  try {
    await taService.postDailyUpdate(interaction.client);
    await interaction.editReply('Posted the TA update.');
  } catch (err) {
    logger.error('Manual /post-ta failed:', err);
    await interaction.editReply('Failed to post the TA update - check the logs for details.');
  }
}

module.exports = { data, execute };
