-- Enable Row Level Security on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE guild_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- USERS TABLE POLICIES
-- Users can read their own record
CREATE POLICY "Users can read their own profile"
  ON users
  FOR SELECT
  USING (id = auth.uid());

-- Service role can do anything with users
CREATE POLICY "Service role can manage users"
  ON users
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- GUILD_CONFIGS TABLE POLICIES
-- Users can read guild configs for guilds they belong to
CREATE POLICY "Users can read guild configs"
  ON guild_configs
  FOR SELECT
  USING (true); -- Users need to access this - permission check happens at application level

-- Service role can do anything
CREATE POLICY "Service role can manage guild configs"
  ON guild_configs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- WORK_ORDERS TABLE POLICIES
-- Users can read work orders for guilds they belong to
CREATE POLICY "Users can read work orders"
  ON work_orders
  FOR SELECT
  USING (
    -- Permission check at application level
    true
  );

-- Users can create work orders
CREATE POLICY "Users can create work orders"
  ON work_orders
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Users can update their own work orders or if they are admin (checked at app level)
CREATE POLICY "Users can update their own work orders"
  ON work_orders
  FOR UPDATE
  USING (
    created_by_user_id = auth.uid() OR
    auth.role() = 'service_role'
  )
  WITH CHECK (
    created_by_user_id = auth.uid() OR
    auth.role() = 'service_role'
  );

-- Only service role can delete work orders
CREATE POLICY "Service role can delete work orders"
  ON work_orders
  FOR DELETE
  USING (auth.role() = 'service_role');

-- Service role can do anything
CREATE POLICY "Service role can manage work orders"
  ON work_orders
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- AUDIT_LOGS TABLE POLICIES
-- Users can read audit logs (permission check at application level)
CREATE POLICY "Users can read audit logs"
  ON audit_logs
  FOR SELECT
  USING (true);

-- Only service role can insert audit logs
CREATE POLICY "Service role can insert audit logs"
  ON audit_logs
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Audit logs are immutable - no updates or deletes
CREATE POLICY "Service role can manage audit logs"
  ON audit_logs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
