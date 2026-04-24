-- AgencyPulse: Initial Schema Migration
-- Phase 1.2 — Core entities: Agency, User, Client, Campaign,
--              StaffClientAssignment, RefreshToken
--
-- Multi-tenancy strategy: shared schema + PostgreSQL Row Level Security (RLS)
-- RLS policies are added in Phase 1.3 (migration 20260416000001_rls_policies)
-- This migration lays the structural foundation that those policies require.

-- ─── Extensions ──────────────────────────────────────────────────────────────

-- pgcrypto: used for gen_random_uuid() as UUID default
-- (Prisma uses its own UUID generation, but good to have available for raw SQL)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Enums ───────────────────────────────────────────────────────────────────

CREATE TYPE "user_role" AS ENUM (
  'PLATFORM_OWNER',
  'AGENCY_OWNER',
  'AGENCY_ADMIN',
  'AGENCY_STAFF',
  'CLIENT_USER'
);

CREATE TYPE "agency_plan" AS ENUM (
  'FREELANCER',
  'AGENCY',
  'AGENCY_PRO'
);

CREATE TYPE "client_status" AS ENUM (
  'ACTIVE',
  'INACTIVE',
  'ARCHIVED'
);

CREATE TYPE "campaign_status" AS ENUM (
  'ACTIVE',
  'PAUSED',
  'INACTIVE'
);

-- ─── agencies ────────────────────────────────────────────────────────────────
-- The tenant entity. agencies.id IS the tenant_id used everywhere else.

CREATE TABLE "agencies" (
  "id"             UUID          NOT NULL DEFAULT gen_random_uuid(),
  "name"           VARCHAR(255)  NOT NULL,
  "slug"           VARCHAR(100)  NOT NULL,
  "logo_url"       VARCHAR(500),
  "primary_color"  VARCHAR(7),
  "custom_domain"  VARCHAR(255),
  "plan"           "agency_plan" NOT NULL DEFAULT 'FREELANCER',
  "is_active"      BOOLEAN       NOT NULL DEFAULT TRUE,
  "owner_id"       UUID,                   -- set after owner user is created
  "created_at"     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updated_at"     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT "agencies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "agencies_slug_key" UNIQUE ("slug"),
  CONSTRAINT "agencies_custom_domain_key" UNIQUE ("custom_domain")
);

-- ─── users ───────────────────────────────────────────────────────────────────

CREATE TABLE "users" (
  "id"                  UUID          NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"           UUID          NOT NULL,
  "email"               VARCHAR(255)  NOT NULL,
  "password_hash"       VARCHAR(255),         -- nullable until invitation accepted
  "first_name"          VARCHAR(100)  NOT NULL,
  "last_name"           VARCHAR(100)  NOT NULL,
  "avatar_url"          VARCHAR(500),
  "role"                "user_role"   NOT NULL,
  "is_active"           BOOLEAN       NOT NULL DEFAULT TRUE,
  "email_verified_at"   TIMESTAMPTZ,
  "last_login_at"       TIMESTAMPTZ,
  "invited_by_id"       UUID,
  "created_at"          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updated_at"          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "users_email_key" UNIQUE ("email"),
  CONSTRAINT "users_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "agencies" ("id") ON DELETE RESTRICT,
  CONSTRAINT "users_invited_by_id_fkey"
    FOREIGN KEY ("invited_by_id") REFERENCES "users" ("id") ON DELETE SET NULL
);

-- Now we can add the owner FK on agencies (circular ref resolved)
ALTER TABLE "agencies"
  ADD CONSTRAINT "agencies_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users" ("id") ON DELETE SET NULL;

CREATE INDEX "users_tenant_id_role_idx"     ON "users" ("tenant_id", "role");
CREATE INDEX "users_tenant_id_is_active_idx" ON "users" ("tenant_id", "is_active");

-- ─── clients ─────────────────────────────────────────────────────────────────

CREATE TABLE "clients" (
  "id"            UUID            NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"     UUID            NOT NULL,
  "name"          VARCHAR(255)    NOT NULL,
  "website"       VARCHAR(500),
  "logo_url"      VARCHAR(500),
  "color"         VARCHAR(7),
  "status"        "client_status" NOT NULL DEFAULT 'ACTIVE',
  "created_by_id" UUID            NOT NULL,
  "created_at"    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  "deleted_at"    TIMESTAMPTZ,              -- soft delete

  CONSTRAINT "clients_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "clients_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "agencies" ("id") ON DELETE RESTRICT,
  CONSTRAINT "clients_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT
);

-- Primary query: list active, non-deleted clients for a tenant
CREATE INDEX "clients_tenant_id_status_deleted_at_idx"
  ON "clients" ("tenant_id", "status", "deleted_at");

-- ─── campaigns ───────────────────────────────────────────────────────────────

CREATE TABLE "campaigns" (
  "id"            UUID             NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"     UUID             NOT NULL,
  "client_id"     UUID             NOT NULL,
  "name"          VARCHAR(255)     NOT NULL,
  "description"   TEXT,
  "status"        "campaign_status" NOT NULL DEFAULT 'ACTIVE',
  "created_by_id" UUID             NOT NULL,
  "created_at"    TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  "deleted_at"    TIMESTAMPTZ,               -- soft delete

  CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "campaigns_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "agencies" ("id") ON DELETE RESTRICT,
  CONSTRAINT "campaigns_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients" ("id") ON DELETE RESTRICT,
  CONSTRAINT "campaigns_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT
);

-- Campaigns per client (most common query)
CREATE INDEX "campaigns_tenant_id_client_id_deleted_at_idx"
  ON "campaigns" ("tenant_id", "client_id", "deleted_at");

-- Filter campaigns by status across a tenant
CREATE INDEX "campaigns_tenant_id_status_deleted_at_idx"
  ON "campaigns" ("tenant_id", "status", "deleted_at");

-- ─── staff_client_assignments ─────────────────────────────────────────────────

CREATE TABLE "staff_client_assignments" (
  "id"             UUID        NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"      UUID        NOT NULL,
  "user_id"        UUID        NOT NULL,  -- must be AGENCY_STAFF
  "client_id"      UUID        NOT NULL,
  "assigned_by_id" UUID        NOT NULL,
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "staff_client_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "staff_client_assignments_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "agencies" ("id") ON DELETE RESTRICT,
  CONSTRAINT "staff_client_assignments_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE,
  CONSTRAINT "staff_client_assignments_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients" ("id") ON DELETE CASCADE,
  CONSTRAINT "staff_client_assignments_assigned_by_id_fkey"
    FOREIGN KEY ("assigned_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT,
  -- A staff member can only be assigned to a client once
  CONSTRAINT "staff_client_assignments_user_id_client_id_key"
    UNIQUE ("user_id", "client_id")
);

CREATE INDEX "staff_client_assignments_tenant_id_client_id_idx"
  ON "staff_client_assignments" ("tenant_id", "client_id");

-- ─── refresh_tokens ───────────────────────────────────────────────────────────

CREATE TABLE "refresh_tokens" (
  "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"   UUID         NOT NULL,
  "user_id"     UUID         NOT NULL,
  "token_hash"  VARCHAR(64)  NOT NULL,  -- SHA-256 hex = 64 chars
  "expires_at"  TIMESTAMPTZ  NOT NULL,
  "revoked_at"  TIMESTAMPTZ,            -- null = valid
  "user_agent"  VARCHAR(500),
  "ip_address"  VARCHAR(45),
  "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "refresh_tokens_token_hash_key" UNIQUE ("token_hash"),
  CONSTRAINT "refresh_tokens_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "agencies" ("id") ON DELETE RESTRICT,
  CONSTRAINT "refresh_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

-- Validate tokens: find active (non-expired, non-revoked) tokens for a user
CREATE INDEX "refresh_tokens_user_id_expires_at_idx"
  ON "refresh_tokens" ("user_id", "expires_at");

-- ─── updated_at auto-update trigger ──────────────────────────────────────────
-- PostgreSQL does not auto-update `updated_at` — Prisma handles this in the ORM,
-- but we add a trigger as a safety net for any direct SQL operations.

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agencies_updated_at
  BEFORE UPDATE ON "agencies"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON "users"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON "clients"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER campaigns_updated_at
  BEFORE UPDATE ON "campaigns"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── RLS groundwork ───────────────────────────────────────────────────────────
-- Actual RLS policies are added in Phase 1.3 (next migration).
-- Here we only enable RLS on each table — this is safe to do now because
-- without policies, the default behaviour for the table OWNER is unrestricted
-- access, so nothing breaks until policies are added.
--
-- NOTE: The application DB role (used by Prisma) must NOT be the table owner.
-- Table owner = migration role (superuser / postgres).
-- Application role = agencypulse (set in DATABASE_URL).
-- This separation is required: table owners bypass RLS entirely.

ALTER TABLE "agencies"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users"                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "clients"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "campaigns"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "staff_client_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "refresh_tokens"         ENABLE ROW LEVEL SECURITY;
