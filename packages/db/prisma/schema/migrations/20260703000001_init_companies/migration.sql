CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,          -- subdomínio ou identificador único
  plan TEXT NOT NULL DEFAULT 'starter',
  status TEXT NOT NULL DEFAULT 'active',
  config JSONB DEFAULT '{}',          -- widget colors, bot name, idioma
  sla_config JSONB DEFAULT '{}',      -- { first_response_minutes: 60, resolution_hours: 24 }
  whatsapp_phone_id TEXT,             -- Meta phone number ID
  whatsapp_token_encrypted TEXT,      -- token criptografado
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
