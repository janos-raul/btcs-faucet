const { REST, Routes } = require('discord.js');
const config = require('../config');
const logger = require('../utils/logger');
const commands = require('./commands');

async function main() {
  const rest = new REST().setToken(config.discord.token);
  const body = commands.map((command) => command.data.toJSON());

  const route = config.discord.guildId
    ? Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId)
    : Routes.applicationCommands(config.discord.clientId);

  logger.info(
    config.discord.guildId
      ? `Registering commands for guild ${config.discord.guildId} (instant)...`
      : 'Registering commands globally (may take up to ~1h to propagate)...'
  );

  await rest.put(route, { body });
  logger.info(`Registered ${body.length} command(s).`);
}

main().catch((err) => {
  logger.error('Failed to register commands:', err);
  process.exit(1);
});
