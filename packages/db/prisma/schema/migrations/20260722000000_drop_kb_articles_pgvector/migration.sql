-- Knowledge Base (kb_articles) is being removed: it was never wired into
-- the bot as an actual tool (only FAQ's list_faqs is — see lib/bot/
-- orchestrator.ts), so it duplicated FAQ's purpose without adding real
-- capability, and dropping it also drops the pgvector dependency entirely
-- (no other feature needs it).
DROP TABLE IF EXISTS kb_articles;
DROP EXTENSION IF EXISTS vector;
