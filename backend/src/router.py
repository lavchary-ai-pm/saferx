"""Confidence-based routing logic for SafeRx.

Determines whether a prescription is auto-approved or routed
to the pharmacist review queue based on the AI's analysis.

The routing threshold is a product decision, not an AI decision.
Even if the AI recommends auto-approve, the system will route
to a pharmacist if confidence is below threshold or risk is
above 'low'. This prevents automation bias.
"""

# Default routing threshold - can be overridden via environment variable
AUTO_APPROVE_CONFIDENCE_THRESHOLD = 0.95
AUTO_APPROVE_MAX_RISK_LEVEL = "low"


def route_prescription(ai_result: dict) -> str:
    """Determine routing for a checked prescription.

    Args:
        ai_result: The parsed AI interaction check result containing
                   risk_level, confidence_score, and recommendation.

    Returns:
        "auto_approved" if the prescription passes both gates,
        "routed_to_pharmacist" otherwise.
    """
    confidence = ai_result.get("confidence_score", 0.0)
    risk_level = ai_result.get("risk_level", "high")

    # Gate 1: Confidence must meet threshold
    confidence_passes = confidence >= AUTO_APPROVE_CONFIDENCE_THRESHOLD

    # Gate 2: Risk must be low
    risk_passes = risk_level == AUTO_APPROVE_MAX_RISK_LEVEL

    # Gate 3: AI must also recommend auto-approve
    # (defense in depth - even if gates 1+2 pass, respect AI's judgment)
    ai_recommends_approve = ai_result.get("recommendation") == "auto_approve"

    if confidence_passes and risk_passes and ai_recommends_approve:
        return "auto_approved"

    return "routed_to_pharmacist"
