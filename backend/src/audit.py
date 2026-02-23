"""Audit logging for SafeRx.

Records every decision (AI recommendation + pharmacist action) for
compliance, analytics, and feedback loop analysis.
"""

import csv
import io
import json
import uuid

from src.database import get_db


def log_decision(
    patient_id_masked: str,
    prescription_id: str,
    medication_name: str,
    ai_recommendation: str | None = None,
    ai_confidence: float | None = None,
    ai_risk_level: str | None = None,
    final_status: str = "pending",
) -> str:
    """Create an audit log entry when the AI makes a recommendation.

    Called after the interaction check completes and routing decision is made.

    Returns:
        The audit log entry ID.
    """
    entry_id = str(uuid.uuid4())
    db = get_db()
    db.execute(
        """INSERT INTO audit_log
        (id, patient_id_masked, prescription_id, medication_name,
         ai_recommendation, ai_confidence, ai_risk_level, final_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            entry_id,
            patient_id_masked,
            prescription_id,
            medication_name,
            ai_recommendation,
            ai_confidence,
            ai_risk_level,
            final_status,
        ),
    )
    db.commit()
    db.close()
    return entry_id


def update_audit_with_review(
    prescription_id: str,
    pharmacist_decision: str,
    pharmacist_feedback: str | None = None,
    ai_pharmacist_agreement: bool | None = None,
    time_to_decision_seconds: int | None = None,
    final_status: str = "approved",
):
    """Update an audit entry after the pharmacist reviews the prescription.

    Adds the human decision alongside the AI recommendation so we can
    calculate override rates and agreement metrics.
    """
    db = get_db()
    agreement_int = None
    if ai_pharmacist_agreement is not None:
        agreement_int = 1 if ai_pharmacist_agreement else 0

    db.execute(
        """UPDATE audit_log SET
        pharmacist_decision = ?,
        pharmacist_feedback = ?,
        ai_pharmacist_agreement = ?,
        time_to_decision_seconds = ?,
        final_status = ?
        WHERE prescription_id = ?""",
        (
            pharmacist_decision,
            pharmacist_feedback,
            agreement_int,
            time_to_decision_seconds,
            final_status,
            prescription_id,
        ),
    )
    db.commit()
    db.close()


def get_audit_log(
    risk_level: str | None = None,
    status: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[dict]:
    """Query audit log entries with optional filters.

    Args:
        risk_level: Filter by AI risk level (low/medium/high/critical).
        status: Filter by final status (approved/rejected/escalated/pending).
        limit: Max rows to return.
        offset: Pagination offset.

    Returns:
        List of audit entries as dicts.
    """
    db = get_db()

    query = "SELECT * FROM audit_log WHERE 1=1"
    params: list = []

    if risk_level:
        query += " AND ai_risk_level = ?"
        params.append(risk_level)

    if status:
        query += " AND final_status = ?"
        params.append(status)

    query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    rows = db.execute(query, params).fetchall()
    db.close()

    return [dict(row) for row in rows]


def get_audit_count(
    risk_level: str | None = None,
    status: str | None = None,
) -> int:
    """Get total count of audit entries matching filters (for pagination)."""
    db = get_db()

    query = "SELECT COUNT(*) as count FROM audit_log WHERE 1=1"
    params: list = []

    if risk_level:
        query += " AND ai_risk_level = ?"
        params.append(risk_level)

    if status:
        query += " AND final_status = ?"
        params.append(status)

    count = db.execute(query, params).fetchone()["count"]
    db.close()
    return count


def export_audit_csv() -> str:
    """Export the full audit log as CSV string.

    Returns:
        CSV-formatted string of all audit entries.
    """
    db = get_db()
    rows = db.execute("SELECT * FROM audit_log ORDER BY timestamp DESC").fetchall()
    db.close()

    if not rows:
        return ""

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=rows[0].keys())
    writer.writeheader()
    for row in rows:
        writer.writerow(dict(row))

    return output.getvalue()
