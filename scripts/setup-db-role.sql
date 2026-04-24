-- AgencyPulse: One-time database role setup
-- Run this ONCE as a PostgreSQL superuser before running migrations.
--
-- Two-role model:
--   agencypulse      — table owner / migration role (superuser-created, owns tables)
--                      → NOT used by the app at runtime (owners bypass RLS)
--   agencypulse_app  — application role (subject to RLS, used by Prisma at runtime)
--                      → Set in DATABASE_URL
--
-- Usage:
--   docker exec -i agencypulse_postgres psql -U agencypulse -d agencypulse < scripts/setup-db-role.sql

-- ─── agencypulse (migration / owner role) ────────────────────────────────────
-- Ensure NOBYPASSRLS is explicit even though it owns tables (belt-and-suspenders)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'agencypulse') THEN
    CREATE ROLE agencypulse LOGIN PASSWORD 'agencypulse_dev' NOBYPASSRLS;
    RAISE NOTICE 'Role agencypulse created.';
  ELSE
    ALTER ROLE agencypulse NOBYPASSRLS;
    RAISE NOTICE 'Role agencypulse already exists — NOBYPASSRLS enforced.';
  END IF;
END
$$;

-- ─── agencypulse_app (application role — subject to RLS) ─────────────────────
-- This is the role Prisma connects as at runtime.
-- It does NOT own any tables, so PostgreSQL RLS policies apply to it fully.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'agencypulse_app') THEN
    CREATE ROLE agencypulse_app LOGIN PASSWORD 'agencypulse_app_dev' NOBYPASSRLS;
    RAISE NOTICE 'Role agencypulse_app created.';
  ELSE
    ALTER ROLE agencypulse_app NOBYPASSRLS;
    RAISE NOTICE 'Role agencypulse_app already exists — NOBYPASSRLS enforced.';
  END IF;
END
$$;

-- ─── Grants for agencypulse_app ───────────────────────────────────────────────
GRANT CONNECT ON DATABASE agencypulse TO agencypulse_app;
GRANT USAGE ON SCHEMA public TO agencypulse_app;

-- Existing tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO agencypulse_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO agencypulse_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO agencypulse_app;

-- Future tables created by migrations (run as agencypulse) also get these grants
ALTER DEFAULT PRIVILEGES FOR ROLE agencypulse IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO agencypulse_app;
ALTER DEFAULT PRIVILEGES FOR ROLE agencypulse IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO agencypulse_app;
ALTER DEFAULT PRIVILEGES FOR ROLE agencypulse IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO agencypulse_app;

\echo ''
\echo 'Setup complete.'
\echo '  Migration role : agencypulse        (table owner, bypasses RLS)'
\echo '  App role       : agencypulse_app    (subject to RLS — use this in DATABASE_URL)'
\echo ''
\echo 'DATABASE_URL = postgresql://agencypulse_app:agencypulse_app_dev@localhost:5433/agencypulse?schema=public'
