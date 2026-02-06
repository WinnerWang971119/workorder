-- Migration 008: RPC function for sorting work orders by subsystem
--
-- Supabase's PostgREST `referencedTable` option in `.order()` only sorts
-- the embedded resource rows, not the parent rows.  For a 1-to-1 join like
-- work_order -> subsystem this does nothing visible.
--
-- This function performs a proper JOIN + ORDER BY so the web dashboard can
-- sort work orders by their subsystem's sort_order on the server side,
-- keeping pagination correct.

CREATE OR REPLACE FUNCTION get_work_orders_by_subsystem(
  p_status TEXT,
  p_offset INTEGER DEFAULT 0,
  p_limit  INTEGER DEFAULT 26
)
RETURNS json
LANGUAGE sql
STABLE
SECURITY INVOKER          -- respects the caller's RLS policies
AS $$
  SELECT COALESCE(json_agg(t), '[]'::json)
  FROM (
    SELECT
      wo.*,
      json_build_object(
        'id',           s.id,
        'guild_id',     s.guild_id,
        'name',         s.name,
        'display_name', s.display_name,
        'emoji',        s.emoji,
        'color',        s.color,
        'sort_order',   s.sort_order,
        'created_at',   s.created_at,
        'updated_at',   s.updated_at
      ) AS subsystem
    FROM work_orders wo
    LEFT JOIN subsystems s ON wo.subsystem_id = s.id
    WHERE wo.status     = p_status
      AND wo.is_deleted = false
    ORDER BY s.sort_order ASC, wo.created_at DESC
    LIMIT  p_limit
    OFFSET p_offset
  ) t;
$$;
