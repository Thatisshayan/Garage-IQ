-- Create the job_statuses table for user-customizable statuses (Approach A).
-- This replaces the fixed job_status ENUM with a flexible, user-managed table.
-- 6 default statuses are seeded matching the original ENUM values.
-- Custom statuses can be added/renamed/reordered/colored by users.
-- The state machine transitions still work for the 6 default statuses by name.

-- 1. Create the table
CREATE TABLE job_statuses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  sort_order INT NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_terminal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- 2. Seed the 6 default statuses (matching the original job_status ENUM)
INSERT INTO job_statuses (name, label, color, sort_order, is_default, is_terminal) VALUES
  ('pending', 'Pending', '#a3a3a3', 0, true, false),
  ('awaiting_insurance', 'Awaiting Insurance', '#eab308', 1, false, false),
  ('parts_ordered', 'Parts Ordered', '#3b82f6', 2, false, false),
  ('in_progress', 'In Progress', '#22c55e', 3, false, false),
  ('awaiting_payment', 'Awaiting Payment', '#a855f7', 4, false, false),
  ('completed', 'Completed', '#16a34a', 5, false, true);

-- 3. Add status_id FK to jobs (keep the old status ENUM column for backward compat)
ALTER TABLE jobs ADD COLUMN status_id UUID REFERENCES job_statuses(id);

UPDATE jobs SET status_id = (SELECT id FROM job_statuses WHERE name = jobs.status::text);

ALTER TABLE jobs ALTER COLUMN status_id SET NOT NULL;

-- 4. Create index for fast lookups
CREATE INDEX idx_jobs_status_id ON jobs(status_id);
CREATE INDEX idx_job_statuses_sort_order ON job_statuses(sort_order);

-- 5. RLS: staff can read/insert/update job_statuses (statuses are shared across the garage)
ALTER TABLE job_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff can read job_statuses"
  ON job_statuses FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "staff can insert job_statuses"
  ON job_statuses FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "staff can update job_statuses"
  ON job_statuses FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "staff can delete job_statuses"
  ON job_statuses FOR DELETE
  USING (auth.role() = 'authenticated');