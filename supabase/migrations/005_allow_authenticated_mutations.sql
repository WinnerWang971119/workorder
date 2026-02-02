-- Allow authenticated web users to update any work order.
-- Permission checks happen at the application level in server actions.
-- This is acceptable for small FRC teams where all logged-in users are trusted.
CREATE POLICY "Authenticated users can update work orders"
  ON work_orders
  FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Allow authenticated users to insert audit log entries from the web dashboard.
-- Previously only the service role (bot) could insert audit logs.
CREATE POLICY "Authenticated users can insert audit logs"
  ON audit_logs
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Allow authenticated users to read all user profiles so we can
-- show display names in the assign dropdown and user references.
CREATE POLICY "Authenticated users can read all user profiles"
  ON users
  FOR SELECT
  USING (auth.uid() IS NOT NULL);
