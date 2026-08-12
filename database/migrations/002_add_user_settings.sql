-- Migration: Add user_settings table
--
-- schema.sql only runs automatically on a FRESH Postgres container init
-- (via docker-entrypoint-initdb.d). It will NOT re-run against a database
-- that already has data. Apply this by hand against any existing database:
--
--   psql -U health_user -d health_db -f database/migrations/002_add_user_settings.sql
--
-- or, if using docker compose's db service:
--
--   docker compose exec -T db psql -U health_user -d health_db < database/migrations/002_add_user_settings.sql
--
-- Note: the backend's startup lifespan (see app/main.py) also calls
-- Base.metadata.create_all(), which will create this table automatically
-- on the next backend restart even without running this file by hand.
-- This migration exists for explicitness/production parity with the
-- existing 001_add_patient_profile_fields.sql pattern.
--
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS user_settings (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    language VARCHAR(10) NOT NULL DEFAULT 'en',
    notify_emergency BOOLEAN NOT NULL DEFAULT TRUE,
    notify_reminder BOOLEAN NOT NULL DEFAULT TRUE,
    notify_info BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
