import type { Subsystem } from '@workorder/shared';
import { supabase } from '../supabase.js';

const SUBSYSTEM_CACHE_TTL_MS = 60_000;
const SUBSYSTEM_FETCH_TIMEOUT_MS = 2_000;
const subsystemCache = new Map<string, { data: Subsystem[]; fetchedAt: number }>();

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
 * Return subsystems for a guild with a small in-memory cache.
 * Autocomplete must respond quickly or Discord expires the interaction.
 */
export async function getSubsystemsForGuildCached(guildId: string): Promise<Subsystem[]> {
  const now = Date.now();
  const cached = subsystemCache.get(guildId);
  if (cached && now - cached.fetchedAt < SUBSYSTEM_CACHE_TTL_MS) {
    return cached.data;
  }

  const fetchPromise = getSubsystemsForGuild(guildId).then((data) => {
    subsystemCache.set(guildId, { data, fetchedAt: Date.now() });
    return data;
  });

  const timeoutPromise = new Promise<Subsystem[]>((resolve) => {
    setTimeout(() => resolve(cached?.data || []), SUBSYSTEM_FETCH_TIMEOUT_MS);
  });

  return Promise.race([fetchPromise, timeoutPromise]);
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
