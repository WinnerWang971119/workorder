import type { Subsystem } from '@workorder/shared';
import { supabase } from '../supabase.js';

/**
 * Return all subsystems for a guild, ordered by sort_order.
 * The bot uses this to populate autocomplete choices.
 */
export async function getSubsystemsForGuild(guildId: string): Promise<Subsystem[]> {
  try {
    const { data, error } = await supabase
      .from('subsystems')
      .select('*')
      .eq('guild_id', guildId)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Failed to fetch subsystems:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching subsystems:', error);
    return [];
  }
}

/**
 * Find a single subsystem by its primary key.
 */
export async function getSubsystemById(id: string): Promise<Subsystem | null> {
  try {
    const { data, error } = await supabase
      .from('subsystems')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Failed to fetch subsystem:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error fetching subsystem:', error);
    return null;
  }
}

/**
 * Call the database function that inserts the four default
 * subsystems (Mechanical, Electrical, Software, General) for a
 * guild, skipping any that already exist.
 */
export async function seedDefaultSubsystems(guildId: string): Promise<void> {
  try {
    const { error } = await supabase.rpc('seed_default_subsystems', {
      target_guild_id: guildId,
    });

    if (error) {
      console.error('Failed to seed default subsystems:', error);
    }
  } catch (error) {
    console.error('Error seeding default subsystems:', error);
  }
}
