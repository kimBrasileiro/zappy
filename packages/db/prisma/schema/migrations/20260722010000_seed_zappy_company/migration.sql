-- Seeds the Zappy company itself (dogfoods the platform for the
-- institutional site's own chat widget, apps/web/app/page.tsx and
-- marketing-home.tsx) directly in a migration instead of only
-- prisma/seed.ts — a forgotten `pnpm db:seed` after a fresh
-- `migrate deploy` silently breaks that chat (company_not_found, no error
-- logged by design, see lib/bot/guardrails.ts). Making it part of the
-- migration means it always exists on any environment that ran migrations,
-- staging/production included, no separate step to remember.
--
-- extraInstructions overrides the orchestrator's global "pricing questions
-- always go to list_services" rule (see lib/bot/orchestrator.ts) for this
-- one company: Zappy's only real Service is a free demo call, not a priced
-- product — the actual plans/prices live in the FAQ below.
INSERT INTO companies (name, slug, plan, config)
VALUES (
  'Zappy',
  'zappy',
  'internal',
  $${"botName": "Assistente Zappy", "extraInstructions": "Você está no chat institucional da própria Zappy (não é um cliente da plataforma). O único item cadastrado em list_services é uma reunião de demonstração gratuita com o time comercial — NÃO é um produto ou plano com preço. Perguntas sobre planos, preços, funcionalidades ou como a Zappy funciona DEVEM ser respondidas via list_faqs (as respostas reais sobre os planos e valores estão lá), NUNCA via list_services. Converse com o cliente e explique o que a Zappy oferece primeiro; só chame list_services ou comece o fluxo de agendamento quando o cliente disser explicitamente que quer marcar, agendar ou falar com o time comercial."}$$::jsonb
)
ON CONFLICT (slug) DO UPDATE SET config = EXCLUDED.config;

INSERT INTO services (company_id, name, description, duration_minutes, price_cents)
SELECT c.id, 'Demo', 'Demonstração guiada da plataforma Zappy com o time comercial.', 30, 0
FROM companies c
WHERE c.slug = 'zappy'
  AND NOT EXISTS (SELECT 1 FROM services s WHERE s.company_id = c.id AND s.name = 'Demo');

INSERT INTO faqs (company_id, question, answer)
SELECT c.id, v.question, v.answer
FROM companies c
CROSS JOIN (VALUES
  ('O que é a Zappy?', 'A Zappy é uma plataforma de atendimento via IA que conversa com seus clientes no seu site e no WhatsApp, tira dúvidas, responde o FAQ da sua empresa e agenda horários automaticamente — com um humano do seu time podendo assumir a conversa a qualquer momento.'),
  ('Quanto custa?', 'O plano básico custa R$ 197/mês e já inclui o widget de chat pro seu site e um número de WhatsApp compartilhado da Zappy. Se você quiser um número de WhatsApp exclusivo da sua empresa, o plano custa R$ 397/mês; se quiser conectar com um sistema de agendamento que você já usa, custa R$ 997/mês. Cada plano já inclui tudo do básico. Todo plano tem 7 dias grátis pra testar.'),
  ('Como funciona o agendamento?', 'Você cadastra seus serviços (nome, duração, preço) no dashboard, e o bot verifica os horários livres e confirma o agendamento direto com o cliente, respeitando o horário de funcionamento da sua empresa.'),
  ('Como funciona o WhatsApp?', 'Toda empresa que assina a Zappy já sai com acesso a um número de WhatsApp compartilhado — o mesmo bot que atende no seu site também atende por lá, identificando automaticamente qual empresa o cliente quer falar.'),
  ('E se o bot não souber responder?', 'O bot encaminha a conversa pra um atendente humano automaticamente, e ela aparece na aba Inbox do seu dashboard pra alguém do seu time responder.'),
  ('Como instalo no meu site?', 'Depois de assinar, você cola uma única linha de <script> no seu site, sem mexer em mais nada, e o chat já aparece funcionando.')
) AS v(question, answer)
WHERE c.slug = 'zappy'
  AND NOT EXISTS (SELECT 1 FROM faqs f WHERE f.company_id = c.id);
