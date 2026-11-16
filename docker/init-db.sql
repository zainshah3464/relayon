-- ═══════════════════════════════════════════════════════════════
-- v3.2 — Postgres init (safe for standard + pgvector images)
-- Runs once on first boot. All statements idempotent.
-- ═══════════════════════════════════════════════════════════════

-- pgvector — only if the extension is available in the image
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') THEN
    CREATE EXTENSION IF NOT EXISTS vector;
    RAISE NOTICE '✅ pgvector extension created';
  ELSE
    RAISE NOTICE '⏭  pgvector not available — skipping (current schema uses Postgres FTS, not embeddings)';
  END IF;
END $$;

-- uuid-ossp — for gen_random_uuid() compatibility with older migrations
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- RLS system role — bypasses row-level security for internal operations
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'relayon_system') THEN
    CREATE ROLE relayon_system NOLOGIN BYPASSRLS;
    RAISE NOTICE '✅ relayon_system role created';
  END IF;
END $$;

GRANT relayon_system TO relayon;

-- Health check: report final state
DO $$
BEGIN
  RAISE NOTICE '═══ Postgres init complete ═══';
  RAISE NOTICE 'Extensions: %', (SELECT string_agg(extname, ', ') FROM pg_extension WHERE extname IN ('vector', 'uuid-ossp'));
  RAISE NOTICE 'RLS role: %', (SELECT rolname FROM pg_roles WHERE rolname = 'relayon_system');
END $$;