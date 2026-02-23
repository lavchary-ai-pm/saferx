"""Seed the SQLite database with synthetic patient data."""

import json
import sys
from pathlib import Path

# Add backend directory to path so imports work when run directly
sys.path.insert(0, str(Path(__file__).parent))

from src.database import init_db, get_db

DATA_DIR = Path(__file__).parent / "data"


def seed_patients():
    """Load patients.json and populate patients + patient_medications tables."""
    patients_file = DATA_DIR / "patients.json"
    if not patients_file.exists():
        print(f"Error: {patients_file} not found")
        return

    with open(patients_file) as f:
        patients = json.load(f)

    db = get_db()

    # Clear existing data (order matters due to foreign keys)
    db.execute("DELETE FROM patient_medications")
    db.execute("DELETE FROM patients")

    patient_count = 0
    med_count = 0

    for patient in patients:
        db.execute(
            "INSERT INTO patients (id, name, date_of_birth, weight_kg, allergies) VALUES (?, ?, ?, ?, ?)",
            (
                patient["id"],
                patient["name"],
                patient["date_of_birth"],
                patient["weight_kg"],
                json.dumps(patient.get("allergies", [])),
            ),
        )
        patient_count += 1

        for med in patient.get("medications", []):
            db.execute(
                """INSERT INTO patient_medications
                (id, patient_id, medication_name, dosage, frequency, prescriber, start_date)
                VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    med["id"],
                    patient["id"],
                    med["medication_name"],
                    med["dosage"],
                    med["frequency"],
                    med.get("prescriber"),
                    med.get("start_date"),
                ),
            )
            med_count += 1

    db.commit()
    db.close()

    print(f"Seeded {patient_count} patients with {med_count} medications.")


def main():
    print("Initializing database...")
    init_db()
    print("Seeding patient data...")
    seed_patients()
    print("Done.")


if __name__ == "__main__":
    main()
