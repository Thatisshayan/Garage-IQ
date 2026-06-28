
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_historical boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_documents_archived_at ON public.documents (archived_at);
CREATE INDEX IF NOT EXISTS idx_documents_is_historical ON public.documents (is_historical);
