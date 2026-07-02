
-- Phase 20: Per-user RLS scoping
-- Each staff member sees only records they created or are assigned to.

-- 1. Add created_by columns to tables that don't have them
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Fix payments.created_by to have a proper FK (it's currently bare UUID)
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_created_by_fkey;
ALTER TABLE public.payments ADD CONSTRAINT payments_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. Backfill created_by from existing data where possible
-- Customers: no way to retroactively determine creator, leave NULL (existing rows become visible to all until re-created)
-- Vehicles: same as customers
-- Invoices: set from the uploading user of the linked document
UPDATE public.invoices i
   SET created_by = d.uploaded_by
  FROM public.documents d
 WHERE i.document_id = d.id
   AND i.created_by IS NULL
   AND d.uploaded_by IS NULL;

-- 4. Drop old permissive policies and replace with per-user policies

-- customers
DROP POLICY IF EXISTS "staff manage customers" ON public.customers;
CREATE POLICY "users manage own customers" ON public.customers FOR ALL TO authenticated
  USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

-- vehicles
DROP POLICY IF EXISTS "staff manage vehicles" ON public.vehicles;
CREATE POLICY "users manage own vehicles" ON public.vehicles FOR ALL TO authenticated
  USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

-- jobs (scope by assigned_to)
DROP POLICY IF EXISTS "staff manage jobs" ON public.jobs;
CREATE POLICY "users manage assigned jobs" ON public.jobs FOR ALL TO authenticated
  USING (assigned_to = auth.uid()) WITH CHECK (assigned_to = auth.uid());

-- documents (scope by uploaded_by)
DROP POLICY IF EXISTS "staff manage documents" ON public.documents;
CREATE POLICY "users manage own documents" ON public.documents FOR ALL TO authenticated
  USING (uploaded_by = auth.uid()) WITH CHECK (uploaded_by = auth.uid());

-- invoices
DROP POLICY IF EXISTS "staff manage invoices" ON public.invoices;
CREATE POLICY "users manage own invoices" ON public.invoices FOR ALL TO authenticated
  USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

-- payments
DROP POLICY IF EXISTS "Staff manage payments" ON public.payments;
CREATE POLICY "users manage own payments" ON public.payments FOR ALL TO authenticated
  USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

-- claim_templates
DROP POLICY IF EXISTS "staff manage claim templates" ON public.claim_templates;
CREATE POLICY "users manage own claim templates" ON public.claim_templates FOR ALL TO authenticated
  USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

-- insurance_claims (scope via jobs.assigned_to)
DROP POLICY IF EXISTS "staff manage claims" ON public.insurance_claims;
CREATE POLICY "users manage job claims" ON public.insurance_claims FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.jobs
    WHERE jobs.id = insurance_claims.job_id
      AND jobs.assigned_to = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.jobs
    WHERE jobs.id = insurance_claims.job_id
      AND jobs.assigned_to = auth.uid()
  ));

-- job_status_events (scope via jobs.assigned_to)
DROP POLICY IF EXISTS "staff read events" ON public.job_status_events;
DROP POLICY IF EXISTS "staff insert events" ON public.job_status_events;
CREATE POLICY "users manage job events" ON public.job_status_events FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.jobs
    WHERE jobs.id = job_status_events.job_id
      AND jobs.assigned_to = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.jobs
    WHERE jobs.id = job_status_events.job_id
      AND jobs.assigned_to = auth.uid()
  ));

-- document_review_queue (scope via documents.uploaded_by)
DROP POLICY IF EXISTS "staff manage review" ON public.document_review_queue;
CREATE POLICY "users manage own doc reviews" ON public.document_review_queue FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.documents
    WHERE documents.id = document_review_queue.document_id
      AND documents.uploaded_by = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.documents
    WHERE documents.id = document_review_queue.document_id
      AND documents.uploaded_by = auth.uid()
  ));

-- 5. Add indexes for the new columns to keep RLS queries fast
CREATE INDEX IF NOT EXISTS idx_customers_created_by ON public.customers(created_by);
CREATE INDEX IF NOT EXISTS idx_vehicles_created_by ON public.vehicles(created_by);
CREATE INDEX IF NOT EXISTS idx_invoices_created_by ON public.invoices(created_by);
