import { config, validateConfig } from './config.js';
import { createClient, registerCommands } from './client.js';
import { handleCreate } from './commands/wo-create.js';
import { handleEdit } from './commands/wo-edit.js';
import { handleRemove } from './commands/wo-remove.js';
import { handleAssign } from './commands/wo-assign.js';
import { handleClaim } from './commands/wo-claim.js';
import { handleUnclaim } from './commands/wo-unclaim.js';
import { handleList } from './commands/wo-list.js';
import { handleFinish } from './commands/wo-finish.js';
import { handleClaimButton } from './buttons/claim-button.js';
import { handleUnclaimButton } from './buttons/unclaim-button.js';
import { handleMarkDoneButton } from './buttons/mark-done-button.js';
import * as subsystemService from './services/subsystem.service.js';
import { ChatInputCommandInteraction, ButtonInteraction, AutocompleteInteraction } from 'discord.js';

/**
 * Handle autocomplete requests for the "subsystem" option.
 * Fetches all subsystems for the guild and filters by the
 * user's current typed text.
 */
async function handleSubsystemAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.respond([]);
    return;
  }

  const subsystems = await subsystemService.getSubsystemsForGuild(guildId);
  const focusedValue = interaction.options.getFocused().toLowerCase();

  const filtered = subsystems
    .filter((s) =>
      s.name.toLowerCase().includes(focusedValue) ||
      s.display_name.toLowerCase().includes(focusedValue)
    )
    .slice(0, 25); // Discord caps autocomplete at 25 results

  await interaction.respond(
    filtered.map((s) => ({
      name: `${s.emoji} ${s.display_name}`,
      value: s.id,
    }))
  );
}

/**
 * Main entry point for the Discord bot
 */
async function main(): Promise<void> {
  try {
    // Validate environment variables
    validateConfig();

    console.log('FRC Work Order Discord Bot starting...');
    console.log(`Environment: ${config.nodeEnv}`);

    // Initialize Discord client
    const client = createClient();

    // Set up event handlers
    client.on('ready', async () => {
      console.log(`Bot logged in as ${client.user?.tag}`);

      // Register slash commands
      await registerCommands(client);
    });

    // Handle all interaction types (commands, buttons, autocomplete)
    client.on('interactionCreate', async (interaction) => {
      // --- Autocomplete (subsystem search) ---
      if (interaction.isAutocomplete()) {
        try {
          const focused = interaction.options.getFocused(true);
          if (focused.name === 'subsystem') {
            await handleSubsystemAutocomplete(interaction);
          }
        } catch (error) {
          console.error('Error handling autocomplete:', error);
        }
        return;
      }

      // --- Slash commands ---
      if (interaction.isChatInputCommand()) {
        const cmd = interaction as ChatInputCommandInteraction;

        try {
          switch (cmd.commandName) {
            case 'wo-create':
              await handleCreate(cmd);
              break;
            case 'wo-edit':
              await handleEdit(cmd);
              break;
            case 'wo-remove':
              await handleRemove(cmd);
              break;
            case 'wo-assign':
              await handleAssign(cmd);
              break;
            case 'wo-claim':
              await handleClaim(cmd);
              break;
            case 'wo-unclaim':
              await handleUnclaim(cmd);
              break;
            case 'wo-list':
              await handleList(cmd);
              break;
            case 'wo-finish':
              await handleFinish(cmd);
              break;
            default:
              await cmd.reply('Unknown command');
          }
        } catch (error) {
          console.error('Error handling command:', error);
          if (!cmd.replied && !cmd.deferred) {
            await cmd.reply({
              content: 'An error occurred while executing the command',
              ephemeral: true,
            });
          }
        }
      }

      // --- Button interactions ---
      if (interaction.isButton()) {
        const btn = interaction as ButtonInteraction;

        try {
          const customId = btn.customId;

          if (customId.startsWith('claim-')) {
            await handleClaimButton(btn);
          } else if (customId.startsWith('unclaim-')) {
            await handleUnclaimButton(btn);
          } else if (customId.startsWith('done-')) {
            await handleMarkDoneButton(btn);
          }
        } catch (error) {
          console.error('Error handling button interaction:', error);
          if (!btn.replied && !btn.deferred) {
            await btn.reply({
              content: 'An error occurred',
              ephemeral: true,
            });
          }
        }
      }
    });

    // Log in to Discord
    await client.login(config.discord.token);

    console.log('Bot ready!');
  } catch (error) {
    console.error('Failed to start bot:', error);
    process.exit(1);
  }
}

main();
