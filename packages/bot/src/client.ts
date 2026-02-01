import { Client, GatewayIntentBits, Collection, SlashCommandBuilder } from 'discord.js';
import { config } from './config.js';

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
 * Register slash commands with Discord API
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
          .setName('category')
          .setDescription('Work order category')
          .setRequired(true)
          .addChoices(
            { name: 'Mechanical', value: 'MECH' },
            { name: 'Electrical', value: 'ELECTRICAL' },
            { name: 'Software', value: 'SOFTWARE' },
            { name: 'General', value: 'GENERAL' }
          )
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
          .setName('category')
          .setDescription('New category')
          .setRequired(false)
          .addChoices(
            { name: 'Mechanical', value: 'MECH' },
            { name: 'Electrical', value: 'ELECTRICAL' },
            { name: 'Software', value: 'SOFTWARE' },
            { name: 'General', value: 'GENERAL' }
          )
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
  ];

  try {
    await client.application?.commands.set(commands);
    console.log('Slash commands registered successfully');
  } catch (error) {
    console.error('Failed to register slash commands:', error);
  }
}
