-- Renames the product from Zappy to Zappigo. The seed company created by
-- migrations/20260722010000_seed_zappy_company (and later touched by
-- 20260722040000_zappy_faq_free_tier) is left as-is in migration history —
-- migrations are immutable — this updates the actual row those two already
-- produced, via a normal UPDATE, not a rewrite of the past.
UPDATE companies
SET name = 'Zappigo',
    slug = 'zappigo',
    config = jsonb_set(
      jsonb_set(config, '{botName}', '"Assistente Zappigo"'),
      '{extraInstructions}',
      to_jsonb(replace(config->>'extraInstructions', 'Zappy', 'Zappigo'))
    )
WHERE slug = 'zappy';

UPDATE services
SET description = replace(description, 'Zappy', 'Zappigo')
FROM companies
WHERE services.company_id = companies.id
  AND companies.slug = 'zappigo';

UPDATE faqs
SET question = replace(question, 'Zappy', 'Zappigo'),
    answer = replace(answer, 'Zappy', 'Zappigo')
FROM companies
WHERE faqs.company_id = companies.id
  AND companies.slug = 'zappigo';
