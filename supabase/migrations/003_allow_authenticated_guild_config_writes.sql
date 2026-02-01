-- Allow authenticated users to insert and update guild configs from the web dashboard.
-- This is acceptable for small FRC teams where all logged-in users are trusted.

CREATE POLICY "Authenticated users can insert guild configs"
  ON guild_configs
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update guild configs"
  ON guild_configs
  FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
