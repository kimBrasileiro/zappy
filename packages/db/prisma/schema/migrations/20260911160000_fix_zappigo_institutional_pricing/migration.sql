-- The institutional "Zappigo" company (slug 'zappigo' — NOT 'zappy', the
-- unrelated/stale slug 20260722010000_seed_zappy_company created) has its
-- own config.extraInstructions overriding the bot's default FAQ-vs-services
-- rule. Confirmed live via a real chat call today: it still tells prospects
-- "está gratuita por enquanto... não precisa de cartão" — true before
-- Stripe went live earlier this session, false now (single paid plan,
-- R$49/mês, 7-day trial). Real prospects hitting the actual marketing-site
-- widget were getting this wrong answer. `||` merge, not a full config
-- replace — preserves whatever else (botName, etc.) already lives there.
UPDATE companies
   SET config = config || '{"extraInstructions": "Você está no chat institucional da própria Zappigo (não é um cliente da plataforma). O único item cadastrado em list_services é uma reunião de demonstração gratuita com o time comercial — NÃO é um produto ou plano com preço. A Zappigo tem um único plano pago, R$49/mês, com 7 dias grátis para testar antes de qualquer cobrança — NÃO é gratuita. Perguntas sobre planos, preços, funcionalidades ou como a Zappigo funciona DEVEM ser respondidas via list_faqs (as respostas reais sobre o plano e o valor estão lá), NUNCA via list_services nem de memória. Converse com o cliente e explique o que a Zappigo oferece primeiro; só chame list_services ou comece o fluxo de agendamento quando o cliente disser explicitamente que quer marcar, agendar ou falar com o time comercial."}'::jsonb
 WHERE slug = 'zappigo';

UPDATE faqs f
   SET answer = 'O plano custa R$ 49/mês e inclui o dashboard de agendamentos, o widget de chat pro seu site e um número de WhatsApp compartilhado da Zappigo. 7 dias grátis pra testar antes de qualquer cobrança.'
  FROM companies c
 WHERE f.company_id = c.id
   AND c.slug = 'zappigo'
   AND f.question = 'Quanto custa?';
