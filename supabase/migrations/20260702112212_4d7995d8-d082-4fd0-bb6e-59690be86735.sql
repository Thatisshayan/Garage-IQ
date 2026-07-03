
CREATE TABLE public.claim_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  insurer text,
  storage_path text NOT NULL,
  field_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.claim_templates TO authenticated;
GRANT ALL ON public.claim_templates TO service_role;

ALTER TABLE public.claim_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff manage claim templates"
  ON public.claim_templates FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER trg_claim_templates_updated_at
  BEFORE UPDATE ON public.claim_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
SET LOCAL search_path TO public, extensions;
CREATE INDEX IF NOT EXISTS idx_vehicles_vin_trgm ON public.vehicles USING gin (vin gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_vehicles_plate_trgm ON public.vehicles USING gin (license_plate gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_phone_trgm ON public.customers USING gin (phone gin_trgm_ops);
