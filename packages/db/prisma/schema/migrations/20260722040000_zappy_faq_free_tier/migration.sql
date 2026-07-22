-- Launch strategy: free for everyone right now (see lib/stripe/plans.ts's
-- FREE_TIER_MODE) — the live chat's own "Quanto custa?" answer needs to
-- match what the marketing page and signup flow now say, or the bot would
-- confidently quote prices nobody is actually being charged. A forward
-- migration (not editing seed data in place) so the original paid-tier
-- answer stays recoverable in migration history, same reasoning as
-- lib/stripe/plans.ts's FREE_TIER_MODE flag itself.
UPDATE faqs
SET answer = 'Nada! Estamos no período de lançamento e a Zappy está gratuita pra todo mundo, incluindo o widget de chat pro seu site e um número de WhatsApp compartilhado. Sem cartão, sem pegadinha — quando isso mudar no futuro, avisamos com bastante antecedência.'
FROM companies
WHERE faqs.company_id = companies.id
  AND companies.slug = 'zappy'
  AND faqs.question = 'Quanto custa?';
