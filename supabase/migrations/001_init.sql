-- supabase/migrations/001_init.sql
-- Table: user_documents
-- Tracks every PDF a user has uploaded
CREATE TABLE public.user_documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename          TEXT NOT NULL,
  file_size         BIGINT,
  chunk_count       INTEGER,
  chroma_collection TEXT NOT NULL, -- ChromaDB collection name
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- Table: query_logs
-- Every question asked, with the answer and sources
CREATE TABLE public.query_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id  UUID REFERENCES public.user_documents(id) ON DELETE CASCADE,
  question     TEXT NOT NULL,
  answer       TEXT,
  sources      JSONB, -- Array of { text, page, score }
  model_used   TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Row Level Security: users only see their OWN data
ALTER TABLE public.user_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.query_logs     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own documents"
  ON public.user_documents FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users see own queries"
  ON public.query_logs FOR ALL
  USING (auth.uid() = user_id);
