"""PHI masking and de-masking for SafeRx.

Strips patient PII before sending data to the AI model.
Preserves medication names, dosages, and frequencies (the AI needs these).
Logs every masking event for audit compliance.
"""

import json
import uuid
from datetime import datetime, date

from src.database import get_db


def _calculate_age(dob_str: str) -> int:
    """Calculate age from date of birth string (YYYY-MM-DD)."""
    dob = date.fromisoformat(dob_str)
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


def _age_to_range(age: int) -> str:
    """Convert exact age to a 10-year range bucket."""
    lower = (age // 10) * 10
    upper = lower + 9
    return f"{lower}-{upper}"


def _weight_to_range(weight_kg: float) -> str:
    """Convert exact weight to a 10kg range bucket."""
    lower = (int(weight_kg) // 10) * 10
    upper = lower + 10
    return f"{lower}-{upper}kg"


def _categorize_allergies(allergies: list[str]) -> list[str]:
    """Replace specific allergy names with general categories."""
    category_map = {
        "Penicillin": "Beta-lactam antibiotics",
        "Amoxicillin": "Beta-lactam antibiotics",
        "Sulfa drugs": "Sulfonamide antibiotics",
        "Aspirin": "NSAIDs/Salicylates",
        "NSAIDs": "NSAIDs/Salicylates",
        "Ibuprofen": "NSAIDs/Salicylates",
        "Codeine": "Opioid analgesics",
        "Morphine": "Opioid analgesics",
        "Latex": "Environmental allergen",
        "Metformin": "Biguanide antidiabetics",
    }
    categories = []
    for allergy in allergies:
        category = category_map.get(allergy, "Other medication allergy")
        if category not in categories:
            categories.append(category)
    return categories


def mask_patient_data(patient: dict, prescription: dict) -> dict:
    """Mask patient PHI for AI processing.

    Returns both raw and masked payloads for the UI comparison view.

    Args:
        patient: Full patient record (from database, with medications).
        prescription: New prescription being submitted.

    Returns:
        Dict with 'raw' and 'masked' keys containing the respective payloads.
    """
    # Build medication list dicts (preserving drug info, stripping prescriber)
    current_meds_raw = [
        {
            "medication_name": med["medication_name"],
            "dosage": med["dosage"],
            "frequency": med["frequency"],
            "prescriber": med.get("prescriber", "Unknown"),
        }
        for med in patient.get("medications", [])
    ]

    current_meds_masked = [
        {
            "medication_name": med["medication_name"],
            "dosage": med["dosage"],
            "frequency": med["frequency"],
        }
        for med in patient.get("medications", [])
    ]

    new_rx_raw = {
        "medication_name": prescription["medication_name"],
        "dosage": prescription["dosage"],
        "frequency": prescription["frequency"],
        "prescriber": prescription["prescriber"],
    }

    new_rx_masked = {
        "medication_name": prescription["medication_name"],
        "dosage": prescription["dosage"],
        "frequency": prescription["frequency"],
    }

    allergies = patient.get("allergies", [])
    if isinstance(allergies, str):
        allergies = json.loads(allergies)

    age = _calculate_age(patient["date_of_birth"])

    raw = {
        "patient_name": patient["name"],
        "date_of_birth": patient["date_of_birth"],
        "weight_kg": patient["weight_kg"],
        "allergies": allergies,
        "current_medications": current_meds_raw,
        "new_prescription": new_rx_raw,
    }

    masked = {
        "patient_id": f"PATIENT_{patient['id'].split('-')[1]}",
        "age_range": _age_to_range(age),
        "weight_range": _weight_to_range(patient["weight_kg"]),
        "allergy_categories": _categorize_allergies(allergies),
        "current_medications": current_meds_masked,
        "new_prescription": new_rx_masked,
    }

    # Log the masking event
    log_masking_event(
        prescription_id=prescription.get("id", "pending"),
        event_type="mask",
        fields_affected=["name", "date_of_birth", "weight_kg", "allergies", "prescriber"],
    )

    return {"raw": raw, "masked": masked}


def log_masking_event(prescription_id: str, event_type: str, fields_affected: list[str]):
    """Record a masking or de-masking event in the audit trail.

    Args:
        prescription_id: The prescription this event relates to.
        event_type: Either 'mask' or 'demask'.
        fields_affected: List of field names that were masked/de-masked.
    """
    db = get_db()
    db.execute(
        """INSERT INTO masking_events (id, prescription_id, event_type, fields_affected)
        VALUES (?, ?, ?, ?)""",
        (
            str(uuid.uuid4()),
            prescription_id,
            event_type,
            json.dumps(fields_affected),
        ),
    )
    db.commit()
    db.close()
