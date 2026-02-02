-- ============================================================
-- Migration: Replace hardcoded categories with dynamic subsystems
-- ============================================================

-- 1. Create subsystems table
-- Each guild can define its own set of subsystems.
CREATE TABLE IF NOT EXISTS subsystems (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  guild_id TEXT NOT NULL REFERENCES guild_configs(guild_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  emoji TEXT DEFAULT '',
  color TEXT DEFAULT '#808080',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(guild_id, name)
);

CREATE INDEX IF NOT EXISTS idx_subsystems_guild_id ON subsystems(guild_id);
CREATE INDEX IF NOT EXISTS idx_subsystems_sort_order ON subsystems(guild_id, sort_order);

-- Updated_at trigger
CREATE TRIGGER subsystems_updated_at BEFORE UPDATE ON subsystems
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. RLS policies for subsystems
ALTER TABLE subsystems ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read subsystems"
  ON subsystems
  FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage subsystems"
  ON subsystems
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Authenticated users can manage subsystems through the dashboard
CREATE POLICY "Authenticated users can insert subsystems"
  ON subsystems
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update subsystems"
  ON subsystems
  FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete subsystems"
  ON subsystems
  FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- 3. Helper function to seed default subsystems for a guild
CREATE OR REPLACE FUNCTION seed_default_subsystems(target_guild_id TEXT)
RETURNS void AS $$
BEGIN
  INSERT INTO subsystems (guild_id, name, display_name, emoji, color, sort_order)
  VALUES
    (target_guild_id, 'MECH',       'Mechanical',  E'\u2699\uFE0F', '#FF6B6B', 1),
    (target_guild_id, 'ELECTRICAL', 'Electrical',  E'\u26A1',       '#4ECDC4', 2),
    (target_guild_id, 'SOFTWARE',   'Software',    E'\U0001F4BB',   '#95E1D3', 3),
    (target_guild_id, 'GENERAL',    'General',     E'\U0001F4CC',   '#FFD93D', 4)
  ON CONFLICT (guild_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- 4. Add subsystem_id column to work_orders (nullable during migration)
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS subsystem_id UUID REFERENCES subsystems(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_work_orders_subsystem_id ON work_orders(subsystem_id);

-- 5. Migrate existing data: create default subsystems for every guild,
--    then point each work order at the matching subsystem row.
DO $$
DECLARE
  guild_record RECORD;
  subsystem_record RECORD;
BEGIN
  FOR guild_record IN SELECT guild_id FROM guild_configs LOOP
    PERFORM seed_default_subsystems(guild_record.guild_id);

    FOR subsystem_record IN
      SELECT id, name FROM subsystems WHERE guild_id = guild_record.guild_id
    LOOP
      UPDATE work_orders
      SET subsystem_id = subsystem_record.id
      WHERE discord_guild_id = guild_record.guild_id
        AND category = subsystem_record.name
        AND subsystem_id IS NULL;
    END LOOP;
  END LOOP;

  -- Handle any work orders whose guild_id is not in guild_configs.
  -- Create guild_configs entries for orphan guilds first, then seed subsystems.
  FOR guild_record IN
    SELECT DISTINCT discord_guild_id FROM work_orders
    WHERE subsystem_id IS NULL
  LOOP
    INSERT INTO guild_configs (guild_id) VALUES (guild_record.discord_guild_id)
    ON CONFLICT (guild_id) DO NOTHING;

    PERFORM seed_default_subsystems(guild_record.discord_guild_id);

    FOR subsystem_record IN
      SELECT id, name FROM subsystems WHERE guild_id = guild_record.discord_guild_id
    LOOP
      UPDATE work_orders
      SET subsystem_id = subsystem_record.id
      WHERE discord_guild_id = guild_record.discord_guild_id
        AND category = subsystem_record.name
        AND subsystem_id IS NULL;
    END LOOP;
  END LOOP;

  -- Fallback: point any remaining NULL subsystem_id rows at the
  -- GENERAL subsystem for their guild so the NOT NULL constraint
  -- can be applied safely.
  UPDATE work_orders wo
  SET subsystem_id = (
    SELECT s.id FROM subsystems s
    WHERE s.guild_id = wo.discord_guild_id AND s.name = 'GENERAL'
    LIMIT 1
  )
  WHERE wo.subsystem_id IS NULL;
END $$;

-- 6. Now that every row has a subsystem_id, make it NOT NULL
ALTER TABLE work_orders ALTER COLUMN subsystem_id SET NOT NULL;

-- 7. Drop the old category column and its CHECK constraint
ALTER TABLE work_orders DROP CONSTRAINT IF EXISTS work_orders_category_check;
ALTER TABLE work_orders DROP COLUMN IF EXISTS category;
