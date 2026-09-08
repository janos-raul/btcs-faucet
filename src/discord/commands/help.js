const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { buildFaucetInfoEmbed } = require('../embeds');

const data = new SlashCommandBuilder().setName('help').setDescription('How to use the BTCS faucet');

async function execute(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const embed = await buildFaucetInfoEmbed({ includeBalance: true });
  await interaction.editReply({ embeds: [embed] });
}

module.exports = { data, execute };
