import { Client, GatewayIntentBits, Collection, SlashCommandBuilder } from 'discord.js';

/**
 * Initialize Discord client
 */
export function createClient(): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  // Store commands in the client
  (client as any).commands = new Collection();

  return client;
}

/**
 * Register slash commands with Discord API.
 * The "subsystem" option uses autocomplete so choices are loaded
 * dynamically from the database rather than being hardcoded.
 */
export async function registerCommands(client: Client): Promise<void> {
  const commands = [
    new SlashCommandBuilder()
      .setName('wo-create')
      .setDescription('Create a new work order')
      .addStringOption((option) =>
        option.setName('title').setDescription('Work order title').setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('subsystem')
          .setDescription('Subsystem (start typing to search)')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addStringOption((option) =>
        option.setName('description').setDescription('Work order description').setRequired(false)
      )
      .addStringOption((option) =>
        option
          .setName('priority')
          .setDescription('Priority level')
          .setRequired(false)
          .addChoices(
            { name: 'Low', value: 'LOW' },
            { name: 'Medium', value: 'MEDIUM' },
            { name: 'High', value: 'HIGH' }
          )
      ),
    new SlashCommandBuilder()
      .setName('wo-edit')
      .setDescription('Edit a work order')
      .addStringOption((option) => option.setName('id').setDescription('Work order ID').setRequired(true))
      .addStringOption((option) =>
        option.setName('title').setDescription('New title').setRequired(false)
      )
      .addStringOption((option) =>
        option.setName('description').setDescription('New description').setRequired(false)
      )
      .addStringOption((option) =>
        option
          .setName('subsystem')
          .setDescription('New subsystem (start typing to search)')
          .setRequired(false)
          .setAutocomplete(true)
      ),
    new SlashCommandBuilder()
      .setName('wo-remove')
      .setDescription('Remove a work order (admin only)')
      .addStringOption((option) => option.setName('id').setDescription('Work order ID').setRequired(true)),
    new SlashCommandBuilder()
      .setName('wo-assign')
      .setDescription('Assign a work order to a user (admin only)')
      .addStringOption((option) => option.setName('id').setDescription('Work order ID').setRequired(true))
      .addUserOption((option) => option.setName('user').setDescription('User to assign to').setRequired(true)),
    new SlashCommandBuilder()
      .setName('wo-claim')
      .setDescription('Claim a work order')
      .addStringOption((option) => option.setName('id').setDescription('Work order ID').setRequired(true)),
    new SlashCommandBuilder()
      .setName('wo-unclaim')
      .setDescription('Unclaim a work order')
      .addStringOption((option) => option.setName('id').setDescription('Work order ID').setRequired(true)),
    new SlashCommandBuilder()
      .setName('wo-list')
      .setDescription('List unfinished work orders for this server'),
    new SlashCommandBuilder()
      .setName('wo-finish')
      .setDescription('Mark a work order as finished (claimer or admin)')
      .addStringOption((option) => option.setName('id').setDescription('Work order ID').setRequired(true)),
  ];

  try {
    await client.application?.commands.set(commands);
    console.log('Slash commands registered successfully');
  } catch (error) {
    console.error('Failed to register slash commands:', error);
  }
}
