CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  phone TEXT,                          -- identificador WhatsApp
  external_id TEXT,                    -- ID no sistema do cliente (CRM, etc.)
  metadata JSONB DEFAULT '{}',
  gdpr_deleted_at TIMESTAMPTZ,         -- anonimização LGPD/GDPR
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, phone),
  UNIQUE(company_id, email)
);
CREATE INDEX idx_customers_company ON customers(company_id);
CREATE INDEX idx_customers_phone ON customers(company_id, phone);
