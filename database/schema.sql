-- AI Powered Personalized Health Assistant - PostgreSQL Schema
--
-- NOTE: roles/labels/types use VARCHAR + CHECK constraints rather than native
-- PostgreSQL ENUM types. This keeps the raw SQL schema and the SQLAlchemy
-- models (which use plain String columns) in exact agreement and avoids the
-- classic "ENUM type name mismatch" class of bugs between an app's ORM layer
-- and hand-written DDL.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'patient' CHECK (role IN ('admin', 'doctor', 'patient')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date_of_birth DATE,
    gender VARCHAR(20),
    height_cm NUMERIC(5,2),
    weight_kg NUMERIC(5,2),
    doctor_id UUID REFERENCES users(id),
    device_id VARCHAR(100) UNIQUE,
    phone_number VARCHAR(20),
    blood_group VARCHAR(5) CHECK (blood_group IS NULL OR blood_group IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
    medical_history TEXT,
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(20),
    photo_url VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE doctors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    specialization VARCHAR(255),
    license_number VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sensor_data (
    id BIGSERIAL PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    heart_rate NUMERIC(5,2),
    spo2 NUMERIC(5,2),
    temperature NUMERIC(5,2),
    steps INTEGER,
    calories NUMERIC(6,2),
    sleep_hours NUMERIC(4,2),
    water_intake_ml INTEGER,
    activity_state VARCHAR(50),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sensor_data_patient_time ON sensor_data (patient_id, recorded_at DESC);

CREATE TABLE predictions (
    id BIGSERIAL PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    sensor_data_id BIGINT REFERENCES sensor_data(id),
    label VARCHAR(50) NOT NULL CHECK (label IN (
        'healthy', 'fatigue', 'stress', 'fever_risk', 'heart_risk', 'sleep_deprivation', 'dehydration'
    )),
    probability NUMERIC(5,4) NOT NULL,
    explanation TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_predictions_patient_time ON predictions (patient_id, created_at DESC);

CREATE TABLE recommendations (
    id BIGSERIAL PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    prediction_id BIGINT REFERENCES predictions(id),
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL DEFAULT 'info' CHECK (type IN ('emergency', 'info', 'reminder')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    scheduled_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'scheduled',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE chat_history (
    id BIGSERIAL PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL, -- 'user' | 'assistant'
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE system_logs (
    id BIGSERIAL PRIMARY KEY,
    level VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    context JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);