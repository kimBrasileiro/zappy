CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE kb_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  embedding vector(1536),             -- OpenAI text-embedding-3-small
  is_public BOOLEAN DEFAULT true,     -- visível no widget ou só para agentes
  active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_kb_company ON kb_articles(company_id);
CREATE INDEX idx_kb_embedding ON kb_articles USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
