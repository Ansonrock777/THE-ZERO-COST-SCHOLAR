ALTER TABLE public.user_documents
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.query_logs
  DROP CONSTRAINT IF EXISTS query_logs_document_id_fkey;

ALTER TABLE public.query_logs
  ADD CONSTRAINT query_logs_document_id_fkey
  FOREIGN KEY (document_id) REFERENCES public.user_documents(id) ON DELETE SET NULL;

ALTER TABLE public.query_logs
  ADD COLUMN IF NOT EXISTS document_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS document_snapshot JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS trace_id UUID;

CREATE TABLE IF NOT EXISTS public.conversations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL DEFAULT 'New inquiry',
  document_ids  UUID[] NOT NULL DEFAULT '{}',
  pinned        BOOLEAN NOT NULL DEFAULT false,
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversation_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role             TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content          TEXT NOT NULL,
  sources          JSONB NOT NULL DEFAULT '[]'::jsonb,
  trace_id         UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversations_user_updated_idx
  ON public.conversations (user_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS conversation_messages_conversation_created_idx
  ON public.conversation_messages (conversation_id, created_at);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own conversations" ON public.conversations;
CREATE POLICY "Users manage own conversations"
  ON public.conversations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own conversation messages" ON public.conversation_messages;
CREATE POLICY "Users manage own conversation messages"
  ON public.conversation_messages FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
