"""Pharmacist feedback collection for SafeRx.

Stores pharmacist decisions and feedback on AI recommendations.
This data feeds the analytics dashboard (override rates, agreement metrics)
and would power a retraining pipeline at scale.
"""

import json
import uuid

from src.database import get_db


def save_review(
    interaction_check_id: str,
    decision: str,
    agrees_with_ai: bool | None = None,
    feedback_text: str | None = None,
    time_to_decision_seconds: int | None = None,
) -> dict:
    """Save a pharmacist's review of an AI interaction check.

    Args:
        interaction_check_id: The interaction check being reviewed.
        decision: 'approved', 'rejected', or 'escalated'.
        agrees_with_ai: Whether the pharmacist agrees with the AI recommendation.
        feedback_text: Optional free-text feedback explaining their reasoning.
        time_to_decision_seconds: How long the pharmacist spent reviewing.

    Returns:
        The saved review as a dict.
    """
    review_id = str(uuid.uuid4())
    db = get_db()

    agrees_int = None
    if agrees_with_ai is not None:
        agrees_int = 1 if agrees_with_ai else 0

    db.execute(
        """INSERT INTO pharmacist_reviews
        (id, interaction_check_id, decision, agrees_with_ai, feedback_text, time_to_decision_seconds)
        VALUES (?, ?, ?, ?, ?, ?)""",
        (
            review_id,
            interaction_check_id,
            decision,
            agrees_int,
            feedback_text,
            time_to_decision_seconds,
        ),
    )
    db.commit()

    row = db.execute(
        "SELECT * FROM pharmacist_reviews WHERE id = ?", (review_id,)
    ).fetchone()
    db.close()

    return dict(row)


def get_review_for_check(interaction_check_id: str) -> dict | None:
    """Get the pharmacist review for a given interaction check, if one exists."""
    db = get_db()
    row = db.execute(
        "SELECT * FROM pharmacist_reviews WHERE interaction_check_id = ?",
        (interaction_check_id,),
    ).fetchone()
    db.close()

    if row:
        return dict(row)
    return None
