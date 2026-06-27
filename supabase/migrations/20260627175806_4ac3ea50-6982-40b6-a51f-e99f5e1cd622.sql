
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'staff');
CREATE TYPE public.job_status AS ENUM ('pending','awaiting_insurance','parts_ordered','in_progress','awaiting_payment','completed');
CREATE TYPE public.doc_type AS ENUM ('invoice','receipt','purchase_order','release_form','insurance_document','other','unclassified');
CREATE TYPE public.doc_processing_status AS ENUM ('pending','processing','extracted','linked','review','error');
CREATE TYPE public.claim_status AS ENUM ('pending','approved','denied','partial');
CREATE TYPE public.payment_status AS ENUM ('unpaid','paid','overdue','disputed');
CREATE TYPE public.review_reason AS ENUM ('unclassified','low_confidence','multi_match','no_match','conflict');
CREATE TYPE public.status_trigger AS ENUM ('event','manual','ai');

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','staff'))
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE user_count INT;
BEGIN
  SELECT count(*) INTO user_count FROM auth.users;
  INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'staff') ON CONFLICT DO NOTHING;
  IF user_count <= 1 THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage customers" ON public.customers FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER customers_updated BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX customers_name_trgm ON public.customers USING gin (name public.gin_trgm_ops);

CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  make TEXT, model TEXT, year INT, vin TEXT, license_plate TEXT, color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;
GRANT ALL ON public.vehicles TO service_role;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage vehicles" ON public.vehicles FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE INDEX vehicles_vin ON public.vehicles (vin);
CREATE INDEX vehicles_plate ON public.vehicles (license_plate);
CREATE INDEX vehicles_customer ON public.vehicles (customer_id);

CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  description TEXT,
  status public.job_status NOT NULL DEFAULT 'pending',
  assigned_to UUID REFERENCES auth.users(id),
  flagged BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated;
GRANT ALL ON public.jobs TO service_role;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage jobs" ON public.jobs FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER jobs_updated BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX jobs_status ON public.jobs (status);
CREATE INDEX jobs_customer ON public.jobs (customer_id);
CREATE INDEX jobs_vehicle ON public.jobs (vehicle_id);

CREATE TABLE public.insurance_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  claim_number TEXT, insurer TEXT, policy_number TEXT,
  status public.claim_status NOT NULL DEFAULT 'pending',
  approved_amount NUMERIC(12,2),
  effective_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insurance_claims TO authenticated;
GRANT ALL ON public.insurance_claims TO service_role;
ALTER TABLE public.insurance_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage claims" ON public.insurance_claims FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER claims_updated BEFORE UPDATE ON public.insurance_claims FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX claims_job ON public.insurance_claims (job_id);
CREATE INDEX claims_number ON public.insurance_claims (claim_number);

CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  type public.doc_type NOT NULL DEFAULT 'unclassified',
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  ocr_text TEXT,
  extracted_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence_score NUMERIC(4,3),
  processing_status public.doc_processing_status NOT NULL DEFAULT 'pending',
  processing_error TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage documents" ON public.documents FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE INDEX documents_job ON public.documents (job_id);
CREATE INDEX documents_type ON public.documents (type);
CREATE INDEX documents_status ON public.documents (processing_status);
CREATE INDEX documents_extracted_gin ON public.documents USING gin (extracted_data);

CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  vendor TEXT,
  invoice_date DATE,
  amount NUMERIC(12,2),
  tax NUMERIC(12,2),
  total NUMERIC(12,2),
  currency TEXT DEFAULT 'USD',
  payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  due_date DATE,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage invoices" ON public.invoices FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE INDEX invoices_job ON public.invoices (job_id);
CREATE INDEX invoices_payment ON public.invoices (payment_status);

CREATE TABLE public.job_status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  from_status public.job_status,
  to_status public.job_status NOT NULL,
  trigger public.status_trigger NOT NULL,
  source_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  reason TEXT,
  actor_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.job_status_events TO authenticated;
GRANT ALL ON public.job_status_events TO service_role;
ALTER TABLE public.job_status_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read events" ON public.job_status_events FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff insert events" ON public.job_status_events FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE INDEX events_job ON public.job_status_events (job_id, created_at DESC);

CREATE TABLE public.document_review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  reason public.review_reason NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_review_queue TO authenticated;
GRANT ALL ON public.document_review_queue TO service_role;
ALTER TABLE public.document_review_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage review" ON public.document_review_queue FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE INDEX review_unresolved ON public.document_review_queue (resolved_at) WHERE resolved_at IS NULL;

CREATE POLICY "staff read workshop docs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'workshop-documents' AND public.is_staff(auth.uid()));
CREATE POLICY "staff upload workshop docs" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'workshop-documents' AND public.is_staff(auth.uid()));
CREATE POLICY "staff update workshop docs" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'workshop-documents' AND public.is_staff(auth.uid()));
CREATE POLICY "staff delete workshop docs" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'workshop-documents' AND public.is_staff(auth.uid()));
