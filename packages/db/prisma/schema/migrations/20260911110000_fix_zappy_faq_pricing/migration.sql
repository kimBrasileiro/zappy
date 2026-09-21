-- The "Quanto custa?" FAQ seeded by 20260722010000_seed_zappy_company still
-- describes the old 3-tier pricing (R$19/397/997) — stale twice over: the
-- product simplified to a single plan earlier this session, and that plan
-- is going from R$19 to R$49/mês now. UPDATE, not a fresh INSERT — the
-- original migration's `WHERE NOT EXISTS` guard means re-running it never
-- touches an already-seeded row, so the only way to fix this one is here.
UPDATE faqs f
   SET answer = 'O plano custa R$ 49/mês e inclui o dashboard de agendamentos, o widget de chat pro seu site e um número de WhatsApp compartilhado da Zappy. 7 dias grátis pra testar antes de qualquer cobrança.'
  FROM companies c
 WHERE f.company_id = c.id
   AND c.slug = 'zappy'
   AND f.question = 'Quanto custa?';
