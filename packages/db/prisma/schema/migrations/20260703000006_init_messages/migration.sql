CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,           -- denormalizado para RLS
  sender_type TEXT NOT NULL,          -- customer | bot | agent | system
  sender_id UUID,                     -- user id se agent, null se bot/customer
  content TEXT NOT NULL,
  content_type TEXT DEFAULT 'text',   -- text | image | file | template
  metadata JSONB DEFAULT '{}',        -- tool_calls, provider usado, tokens, custo
  is_internal BOOLEAN DEFAULT false,  -- nota interna (só agentes veem)
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_messages_ticket ON messages(ticket_id);
CREATE INDEX idx_messages_company ON messages(company_id);
