-- Pau Brasil: first company on the sports-court modality
-- (config.modality = 'sports_classes', see apps/web/lib/modality.ts and
-- sports.prisma) — 3 sand courts running beach tennis / futevôlei / vôlei
-- classes at three levels. Same seeding convention as
-- 20260911100000_seed_demo_barbearia_petshop: fixed company id (so a
-- companion call to the signup API can attach a dashboard login), and every
-- statement is idempotent / DO NOTHING so Kim's later dashboard edits (court
-- names, grid, prices, FAQs) are never overwritten by a re-run.
--
-- The grid, capacities, price and FAQ copy below are PROPOSED DEFAULTS, not
-- real business data — meant to be adjusted in the dashboard. Address is left
-- out on purpose (not provided): the bot simply skips the address line until
-- one is set under Início → nome/descrição/endereço.

INSERT INTO companies (id, name, slug, plan, status, business_type, config)
VALUES (
  '5604b376-f9bf-40be-ae8a-edba03348c9b',
  'Pau Brasil',
  'pau-brasil',
  'starter',
  'active',
  'quadra_esportes',
  '{
    "modality": "sports_classes",
    "description": "Aulas de beach tennis, futevôlei e vôlei de areia pra todos os níveis — reserve sua vaga pelo WhatsApp ou pelo site.",
    "businessHours": {
      "sun": null,
      "mon": ["07:00", "22:00"],
      "tue": ["07:00", "22:00"],
      "wed": ["07:00", "22:00"],
      "thu": ["07:00", "22:00"],
      "fri": ["07:00", "22:00"],
      "sat": ["08:00", "14:00"]
    }
  }'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO courts (company_id, name, description, sort_order)
SELECT '5604b376-f9bf-40be-ae8a-edba03348c9b', v.name, v.description, v.sort_order
FROM (VALUES
  ('Quadra 1', 'Quadra de areia 1', 1),
  ('Quadra 2', 'Quadra de areia 2', 2),
  ('Quadra 3', 'Quadra de areia 3', 3)
) AS v(name, description, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM courts c
  WHERE c.company_id = '5604b376-f9bf-40be-ae8a-edba03348c9b' AND c.name = v.name
);

-- Weekly grid: Mon–Fri 18h/19h/20h and Sat 9h/10h/11h, 60-minute classes.
-- The hour picks the level (1st slot iniciante, 2nd intermediário, 3rd
-- avançado) and the sport rotates by court+weekday, so on any given day the
-- three courts run the three sports side by side and every sport reaches
-- every level during the week. Capacity 8 (beach tennis, futevôlei) / 12
-- (vôlei); R$ 60,00 per class — placeholders.
WITH court_idx AS (
  SELECT id, (row_number() OVER (ORDER BY sort_order) - 1) AS ci
  FROM courts
  WHERE company_id = '5604b376-f9bf-40be-ae8a-edba03348c9b'
),
levels AS (
  SELECT * FROM (VALUES (0, 'iniciante'), (1, 'intermediario'), (2, 'avancado')) AS v(si, level)
),
days AS (
  SELECT generate_series(1, 6) AS weekday
),
sports AS (
  SELECT * FROM (VALUES (0, 'beach_tennis', 8), (1, 'futevolei', 8), (2, 'volei', 12)) AS v(idx, sport, capacity)
),
grid AS (
  SELECT
    ci.id AS court_id,
    sp.sport,
    sp.capacity,
    lv.level,
    d.weekday,
    (CASE WHEN d.weekday = 6
       THEN (ARRAY['09:00', '10:00', '11:00'])[lv.si + 1]
       ELSE (ARRAY['18:00', '19:00', '20:00'])[lv.si + 1]
     END) AS start_time
  FROM court_idx ci
  CROSS JOIN days d
  CROSS JOIN levels lv
  JOIN sports sp ON sp.idx = ((ci.ci + d.weekday) % 3)
)
INSERT INTO sport_classes (company_id, court_id, sport, level, weekday, start_time, duration_minutes, capacity, price_cents)
SELECT '5604b376-f9bf-40be-ae8a-edba03348c9b', g.court_id, g.sport, g.level, g.weekday, g.start_time, 60, g.capacity, 6000
FROM grid g
WHERE NOT EXISTS (
  SELECT 1 FROM sport_classes x
  WHERE x.court_id = g.court_id AND x.weekday = g.weekday AND x.start_time = g.start_time
);

INSERT INTO faqs (company_id, question, answer)
SELECT '5604b376-f9bf-40be-ae8a-edba03348c9b', v.question, v.answer
FROM (VALUES
  ('Como sei qual é o meu nível?', 'Iniciante: nunca jogou ou está começando. Intermediário: já joga com regularidade e domina o básico. Avançado: joga bem, com boa técnica e ritmo de jogo. Na dúvida, escolha o mais baixo — dá pra subir de nível depois.'),
  ('Posso fazer uma aula experimental?', 'Pode sim! É só escolher uma aula do seu nível e reservar a vaga — nossa equipe te recebe e ajuda a confirmar o nível certo.'),
  ('O que preciso levar?', 'Roupa leve de treino, protetor solar e água — os jogos são na areia. Sobre raquete e bola, pergunte pra nossa equipe quando reservar a vaga.'),
  ('E se chover?', 'Em caso de chuva forte ou qualquer condição que impeça a aula, avisamos os alunos inscritos e a aula pode ser remarcada.'),
  ('Posso cancelar ou trocar de horário?', 'Pode sim! É só avisar por aqui com a maior antecedência possível pra liberarmos a vaga pra outro aluno.'),
  ('Posso reservar uma quadra só pro meu grupo?', 'Pode! Escolha um horário livre da quadra e informe quantas pessoas vão jogar. Pra eventos de empresa ou aniversário, chamamos alguém da equipe pra combinar os detalhes com você.')
) AS v(question, answer)
WHERE NOT EXISTS (
  SELECT 1 FROM faqs f
  WHERE f.company_id = '5604b376-f9bf-40be-ae8a-edba03348c9b' AND f.question = v.question
);
