-- Migration: Add Patient Profile fields
--
-- schema.sql only runs automatically on a FRESH Postgres container init
-- (via docker-entrypoint-initdb.d). It will NOT re-run against a database
-- that already has data. Apply this by hand against any existing database:
--
--   psql -U health_user -d health_db -f database/migrations/001_add_patient_profile_fields.sql
--
-- or, if using docker compose's db service:
--
--   docker compose exec -T db psql -U health_user -d health_db < database/migrations/001_add_patient_profile_fields.sql
--
-- Safe to run more than once.

ALTER TABLE patients ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS blood_group VARCHAR(5);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS medical_history TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(255);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(20);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS photo_url VARCHAR(500);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'patients_blood_group_check'
    ) THEN
        ALTER TABLE patients
            ADD CONSTRAINT patients_blood_group_check
            CHECK (blood_group IS NULL OR blood_group IN ('A+','A-','B+','B-','AB+','AB-','O+','O-'));
    END IF;
END $$;