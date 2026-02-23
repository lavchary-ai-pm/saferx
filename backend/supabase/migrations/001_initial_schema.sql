-- SafeRx Initial Schema (PostgreSQL / Supabase)
-- This mirrors the SQLite schema in src/database.py for production deployment.

CREATE TABLE IF NOT EXISTS patients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    date_of_birth TEXT NOT NULL,
    weight_kg REAL NOT NULL,
    allergies JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS patient_medications (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES patients(id),
    medication_name TEXT NOT NULL,
    dosage TEXT NOT NULL,
    frequency TEXT NOT NULL,
    prescriber TEXT,
    start_date TEXT,
    active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS prescriptions (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES patients(id),
    medication_name TEXT NOT NULL,
    dosage TEXT NOT NULL,
    frequency TEXT NOT NULL,
    prescriber TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS interaction_checks (
    id TEXT PRIMARY KEY,
    prescription_id TEXT NOT NULL REFERENCES prescriptions(id),
    risk_level TEXT NOT NULL,
    confidence_score REAL NOT NULL,
    interactions_found JSONB NOT NULL,
    recommendation TEXT NOT NULL,
    reasoning TEXT NOT NULL,
    masked_payload JSONB NOT NULL,
    raw_payload JSONB NOT NULL,
    routing_decision TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pharmacist_reviews (
    id TEXT PRIMARY KEY,
    interaction_check_id TEXT NOT NULL REFERENCES interaction_checks(id),
    decision TEXT NOT NULL,
    agrees_with_ai BOOLEAN,
    feedback_text TEXT,
    time_to_decision_seconds INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS masking_events (
    id TEXT PRIMARY KEY,
    prescription_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    fields_affected JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT now(),
    patient_id_masked TEXT NOT NULL,
    prescription_id TEXT NOT NULL,
    medication_name TEXT NOT NULL,
    ai_recommendation TEXT,
    ai_confidence REAL,
    ai_risk_level TEXT,
    pharmacist_decision TEXT,
    pharmacist_feedback TEXT,
    ai_pharmacist_agreement BOOLEAN,
    time_to_decision_seconds INTEGER,
    final_status TEXT NOT NULL
);
