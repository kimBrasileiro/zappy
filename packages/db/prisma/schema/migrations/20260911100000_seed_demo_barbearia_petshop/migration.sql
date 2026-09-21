-- Two showcase companies for demoing the platform to real barbearias/pet
-- shops (Kim's own sales walkthrough — WhatsApp, widget, and the public
-- booking form). Same rationale as 20260722010000_seed_zappy_company: part
-- of a migration so they always exist on every environment that ran
-- migrations, not a separate step to remember. Ids are fixed literals
-- (not gen_random_uuid()) so a companion script can call the real signup
-- API with a known companyId to create working dashboard logins for each.
--
-- ON CONFLICT (id) DO NOTHING throughout — once Kim starts editing these
-- (staff names, prices, FAQs) via the dashboard, a migration re-run must
-- never clobber his changes.

INSERT INTO companies (id, name, slug, plan, status, config)
VALUES (
  'efd48507-909b-4edc-bd4a-03f9e65a6a72',
  'Barbearia do Kim',
  'barbearia-do-kim',
  'starter',
  'active',
  '{"description": "Barbearia tradicional na Vila Mariana — corte, barba e combo, com hora marcada pelo WhatsApp.", "address": "Rua Harmonia, 123 — Vila Madalena, São Paulo - SP"}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- All 4 barbeiros work every service — same staff_names roster on all
-- three, per lib/bot/services.ts's "no separate Staff entity" model.
INSERT INTO services (company_id, name, description, duration_minutes, price_cents, category, staff_names)
SELECT 'efd48507-909b-4edc-bd4a-03f9e65a6a72', v.name, v.description, v.duration, v.price, v.category,
       ARRAY['Bruno', 'Carlos', 'Rafael', 'Thiago']
FROM (VALUES
  ('Corte de cabelo', 'Corte tradicional, na tesoura ou máquina, do jeito que você preferir.', 30, 6000, 'Cabelo'),
  ('Barba', 'Barba feita na navalha, com toalha quente.', 30, 6000, 'Barba'),
  ('Combo Cabelo + Barba', 'Corte de cabelo e barba no mesmo horário, com desconto.', 60, 12000, 'Combo')
) AS v(name, description, duration, price, category)
WHERE NOT EXISTS (
  SELECT 1 FROM services s WHERE s.company_id = 'efd48507-909b-4edc-bd4a-03f9e65a6a72' AND s.name = v.name
);

INSERT INTO faqs (company_id, question, answer)
SELECT 'efd48507-909b-4edc-bd4a-03f9e65a6a72', v.question, v.answer
FROM (VALUES
  ('Qual o horário de funcionamento?', 'Funcionamos de segunda a sábado, das 9h às 18h. Aos domingos ficamos fechados.'),
  ('Quais as formas de pagamento?', 'Aceitamos Pix, cartão de débito e crédito, e dinheiro.'),
  ('Preciso agendar ou posso chegar e esperar?', 'Recomendamos agendar pelo WhatsApp pra garantir seu horário certinho, mas também atendemos quem chega sem hora marcada, se tivermos vaga no momento.'),
  ('Tem estacionamento?', 'Temos vagas na rua próximas ao salão. Não temos estacionamento próprio.'),
  ('Posso cancelar ou remarcar meu horário?', 'Pode sim! É só responder por aqui mesmo, com a maior antecedência possível pra gente poder encaixar outro cliente no seu lugar.')
) AS v(question, answer)
WHERE NOT EXISTS (
  SELECT 1 FROM faqs f WHERE f.company_id = 'efd48507-909b-4edc-bd4a-03f9e65a6a72' AND f.question = v.question
);

INSERT INTO companies (id, name, slug, plan, status, config)
VALUES (
  '46746acc-5c4d-4338-be6d-265baa5cf16f',
  'Pet Shop do Kim',
  'pet-shop-do-kim',
  'starter',
  'active',
  '{"description": "Banho e tosa pra cães e gatos de todos os portes, na Vila Mariana — agende pelo WhatsApp.", "address": "Rua Harmonia, 123 — Vila Madalena, São Paulo - SP"}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Price/duration vary by porte (pet size) — showcases the variants field
-- (service.prisma) instead of a hardcoded per-vertical size field. No
-- staff_names: single generic provider, same as any service that doesn't
-- opt into the staff concept.
INSERT INTO services (company_id, name, description, duration_minutes, price_cents, category, variants)
SELECT '46746acc-5c4d-4338-be6d-265baa5cf16f', v.name, v.description, v.duration, v.price, v.category, v.variants::jsonb
FROM (VALUES
  ('Banho', 'Banho com shampoo neutro, secagem e escovação.', 60, 6000, 'Banho',
   '[{"label":"Pequeno","priceCents":4000,"durationMinutes":45},{"label":"Médio","priceCents":6000,"durationMinutes":60},{"label":"Grande","priceCents":8000,"durationMinutes":75}]'),
  ('Tosa', 'Tosa higiênica ou na máquina, do jeito que preferir.', 45, 5000, 'Tosa',
   '[{"label":"Pequeno","priceCents":3500,"durationMinutes":30},{"label":"Médio","priceCents":5000,"durationMinutes":45},{"label":"Grande","priceCents":7000,"durationMinutes":60}]'),
  ('Banho e Tosa', 'Combo completo: banho e tosa no mesmo horário.', 90, 9500, 'Combo',
   '[{"label":"Pequeno","priceCents":6500,"durationMinutes":70},{"label":"Médio","priceCents":9500,"durationMinutes":90},{"label":"Grande","priceCents":13000,"durationMinutes":120}]')
) AS v(name, description, duration, price, category, variants)
WHERE NOT EXISTS (
  SELECT 1 FROM services s WHERE s.company_id = '46746acc-5c4d-4338-be6d-265baa5cf16f' AND s.name = v.name
);

INSERT INTO faqs (company_id, question, answer)
SELECT '46746acc-5c4d-4338-be6d-265baa5cf16f', v.question, v.answer
FROM (VALUES
  ('Qual o horário de funcionamento?', 'Funcionamos de segunda a sábado, das 9h às 18h. Aos domingos ficamos fechados.'),
  ('Preciso levar meu pet com coleira?', 'Sim, pedimos que traga com coleira ou guia por segurança na chegada e saída.'),
  ('Vocês atendem gatos também?', 'Sim! Atendemos cães e gatos de todos os portes.'),
  ('Como funciona o preço por porte do pet?', 'O valor varia conforme o porte do animal (pequeno, médio ou grande) — é só escolher o serviço que a gente confirma o valor certinho pro seu pet.'),
  ('Posso cancelar ou remarcar?', 'Pode sim! É só responder por aqui mesmo, com a maior antecedência possível pra gente poder encaixar outro cliente no seu lugar.')
) AS v(question, answer)
WHERE NOT EXISTS (
  SELECT 1 FROM faqs f WHERE f.company_id = '46746acc-5c4d-4338-be6d-265baa5cf16f' AND f.question = v.question
);
