ALTER TABLE companies ADD COLUMN allowed_domains TEXT[] NOT NULL DEFAULT '{}';
