const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const { buildFaucetInfoEmbed } = require('../embeds');
const logger = require('../../utils/logger');

const data = new SlashCommandBuilder()
  .setName('faucet-setup')
  .setDescription('Post and pin the faucet usage instructions in this channel (admin only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

async function execute(interaction) {
  if (!interaction.inGuild() || interaction.channel?.type !== ChannelType.GuildText) {
    await interaction.reply({
      content: 'This can only be used in a server text channel.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    // Unpin any previous instructions this bot posted, so re-running the
    // command (e.g. after changing FAUCET_MIN_AMOUNT/MAX_AMOUNT) doesn't
    // leave stale copies pinned.
    const pinned = await interaction.channel.messages.fetchPinned();
    const ownPinned = pinned.filter((message) => message.author.id === interaction.client.user.id);
    for (const message of ownPinned.values()) {
      await message.unpin().catch(() => {});
    }

    const embed = await buildFaucetInfoEmbed({ includeBalance: true });
    const posted = await interaction.channel.send({ embeds: [embed] });
    await posted.pin();

    await interaction.editReply('Posted and pinned the faucet instructions in this channel.');
  } catch (err) {
    logger.error('Failed to post/pin faucet instructions:', err);
    await interaction.editReply(
      "Couldn't post/pin the instructions - make sure I have Send Messages and Manage Messages permissions in this channel."
    );
  }
}

module.exports = { data, execute };
