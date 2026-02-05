-- Migration 007: Add CAD link column and priority sort generated column
--
-- cad_link: optional URL field for linking to CAD files (Onshape, etc.)
-- priority_sort: generated column that maps priority text to integers
--   so that ORDER BY priority_sort gives logical ordering (HIGH=1 first).

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS cad_link TEXT DEFAULT NULL;

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS priority_sort INTEGER
    GENERATED ALWAYS AS (
      CASE priority
        WHEN 'HIGH'   THEN 1
        WHEN 'MEDIUM' THEN 2
        WHEN 'LOW'    THEN 3
      END
    ) STORED;
