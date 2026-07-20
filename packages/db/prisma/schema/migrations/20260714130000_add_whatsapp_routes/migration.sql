CREATE TABLE whatsapp_routes (
  wa_phone_number TEXT PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_whatsapp_routes_company ON whatsapp_routes(company_id);
CREATE INDEX idx_whatsapp_routes_customer ON whatsapp_routes(customer_id);
