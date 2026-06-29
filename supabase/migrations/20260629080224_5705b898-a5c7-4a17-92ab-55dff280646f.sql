
DO $$ BEGIN
  CREATE TYPE public.payer_type AS ENUM ('insurance','client','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  payer_type public.payer_type NOT NULL DEFAULT 'client',
  payer_name TEXT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'CAD',
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  method TEXT,
  note TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payments_job_id_idx ON public.payments(job_id);
CREATE INDEX IF NOT EXISTS payments_paid_at_idx ON public.payments(paid_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage payments"
  ON public.payments FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER payments_touch_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Add optional total_owed column on jobs for ledger balance (estimate / quoted total)
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS total_owed NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS reported_problem TEXT,
  ADD COLUMN IF NOT EXISTS odometer INTEGER;
