const { Client, GatewayIntentBits, Collection, MessageFlags } = require('discord.js');
const config = require('../config');
const logger = require('../utils/logger');
const commands = require('./commands');
const { startScheduler } = require('./scheduler');

function createBot() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.commands = new Collection();
  for (const command of commands) {
    client.commands.set(command.data.name, command);
  }

  client.once('clientReady', () => {
    logger.info(`Discord bot logged in as ${client.user.tag}`);
    startScheduler(client);
  });

  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (err) {
      logger.error(`Error handling /${interaction.commandName}:`, err);
      const errorMessage = 'Something went wrong running that command.';
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errorMessage).catch(() => {});
      } else {
        await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral }).catch(() => {});
      }
    }
  });

  return client;
}

function start() {
  const client = createBot();
  client.login(config.discord.token).catch((err) => {
    logger.error('Failed to log in to Discord:', err.message);
    process.exit(1);
  });
  return client;
}

module.exports = { createBot, start };
