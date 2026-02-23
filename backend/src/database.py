"""SQLite database initialization and connection management."""

import os
import sqlite3
from pathlib import Path

DATABASE_PATH = os.getenv("DATABASE_PATH", "./saferx.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS patients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    date_of_birth TEXT NOT NULL,
    weight_kg REAL NOT NULL,
    allergies TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS patient_medications (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES patients(id),
    medication_name TEXT NOT NULL,
    dosage TEXT NOT NULL,
    frequency TEXT NOT NULL,
    prescriber TEXT,
    start_date TEXT,
    active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS prescriptions (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES patients(id),
    medication_name TEXT NOT NULL,
    dosage TEXT NOT NULL,
    frequency TEXT NOT NULL,
    prescriber TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS interaction_checks (
    id TEXT PRIMARY KEY,
    prescription_id TEXT NOT NULL REFERENCES prescriptions(id),
    risk_level TEXT NOT NULL,
    confidence_score REAL NOT NULL,
    interactions_found TEXT NOT NULL,
    recommendation TEXT NOT NULL,
    reasoning TEXT NOT NULL,
    masked_payload TEXT NOT NULL,
    raw_payload TEXT NOT NULL,
    routing_decision TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pharmacist_reviews (
    id TEXT PRIMARY KEY,
    interaction_check_id TEXT NOT NULL REFERENCES interaction_checks(id),
    decision TEXT NOT NULL,
    agrees_with_ai INTEGER,
    feedback_text TEXT,
    time_to_decision_seconds INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS masking_events (
    id TEXT PRIMARY KEY,
    prescription_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    fields_affected TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    timestamp TEXT DEFAULT (datetime('now')),
    patient_id_masked TEXT NOT NULL,
    prescription_id TEXT NOT NULL,
    medication_name TEXT NOT NULL,
    ai_recommendation TEXT,
    ai_confidence REAL,
    ai_risk_level TEXT,
    pharmacist_decision TEXT,
    pharmacist_feedback TEXT,
    ai_pharmacist_agreement INTEGER,
    time_to_decision_seconds INTEGER,
    final_status TEXT NOT NULL
);
"""


def get_db() -> sqlite3.Connection:
    """Get a database connection with row factory enabled."""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    """Create all tables if they don't exist."""
    conn = get_db()
    conn.executescript(SCHEMA)
    conn.commit()
    conn.close()
