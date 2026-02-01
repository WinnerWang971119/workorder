import type { User } from '@workorder/shared';
import { supabase } from '../supabase.js';

/**
 * Get or create a user from Discord info.
 * Uses upsert to avoid race conditions when multiple commands
 * try to create the same user simultaneously.
 */
export async function getOrCreateUser(
  discordUserId: string,
  username: string,
  avatarUrl: string | null
): Promise<User | null> {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .upsert(
        {
          discord_user_id: discordUserId,
          display_name: username,
          avatar_url: avatarUrl,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'discord_user_id' }
      )
      .select()
      .single();

    if (error) {
      console.error('Failed to upsert user:', error);
      return null;
    }

    return user;
  } catch (error) {
    console.error('Error in getOrCreateUser:', error);
    return null;
  }
}

/**
 * Get user by Discord snowflake ID
 */
export async function getUserByDiscordId(discordUserId: string): Promise<User | null> {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('discord_user_id', discordUserId)
      .single();

    if (error) {
      // PGRST116 means no rows found, which is not an error worth logging
      if (error.code !== 'PGRST116') {
        console.error('Error fetching user:', error);
      }
      return null;
    }

    return user;
  } catch (error) {
    console.error('Error in getUserByDiscordId:', error);
    return null;
  }
}
