"""Claude API integration for medication interaction analysis.

Sends masked patient data to Claude Sonnet with the drug interaction
knowledge base as context. Returns structured risk assessment.
"""

import json
import os
from pathlib import Path

import anthropic
from dotenv import load_dotenv

load_dotenv()

DATA_DIR = Path(__file__).parent.parent / "data"

# Load interaction knowledge base once at module level
_interactions_kb: list[dict] | None = None


def _get_knowledge_base() -> list[dict]:
    """Load and cache the drug interaction knowledge base."""
    global _interactions_kb
    if _interactions_kb is None:
        with open(DATA_DIR / "interactions.json") as f:
            _interactions_kb = json.load(f)
    return _interactions_kb


SYSTEM_PROMPT = """You are a medication interaction safety analyst for a pharmacy system.

Your role is to analyze a new prescription against a patient's current medications
and identify potential drug-drug interactions.

## Drug Interaction Knowledge Base

Use the following verified interaction rules as your PRIMARY reference.
You may also use your general pharmacological knowledge to identify interactions
not in this database, but clearly distinguish between "known interaction from database"
and "potential interaction from general knowledge" in your reasoning.

{knowledge_base}

## Response Format

You MUST respond with valid JSON matching this exact structure:

{{
  "risk_level": "low" | "medium" | "high" | "critical",
  "confidence_score": <float between 0.0 and 1.0>,
  "interactions_found": [
    {{
      "drug_a": "<medication name>",
      "drug_b": "<medication name>",
      "severity": "minor" | "moderate" | "severe" | "critical",
      "description": "<brief clinical description of the interaction>",
      "mechanism": "<pharmacological mechanism>",
      "recommendation": "<clinical recommendation>"
    }}
  ],
  "recommendation": "auto_approve" | "pharmacist_review" | "reject",
  "reasoning": "<detailed explanation of your analysis>"
}}

## Rules for risk_level assignment:
- "critical": Any critical-severity interaction found. Immediate danger to patient.
- "high": Any severe-severity interaction found. Significant clinical risk.
- "medium": Only moderate-severity interactions found. Requires monitoring or dose adjustment.
- "low": Only minor interactions or no interactions found. Generally safe.

## Rules for confidence_score:
- 1.0: Interaction is explicitly in the knowledge base with exact drug match.
- 0.85-0.99: Strong match (same drug class, well-documented interaction).
- 0.70-0.84: Moderate confidence (related drug class, probable interaction).
- 0.50-0.69: Low confidence (theoretical interaction, limited evidence).
- Below 0.50: Very uncertain. Flag for pharmacist review regardless.

## Rules for recommendation:
- "reject": Critical interactions that are absolutely contraindicated.
- "pharmacist_review": Any interaction requiring clinical judgment.
- "auto_approve": No clinically significant interactions found AND confidence >= 0.95.

## Important:
- If NO interactions are found, set risk_level to "low", confidence_score to 0.98,
  interactions_found to an empty array, and recommendation to "auto_approve".
- Consider the patient's allergy categories when assessing risk.
- Always provide detailed reasoning explaining your analysis step by step.
- Respond ONLY with the JSON object. No markdown, no code fences, no extra text."""


def check_interactions(masked_payload: dict) -> dict:
    """Send masked patient data to Claude for interaction analysis.

    Args:
        masked_payload: The masked patient data (no PII) with current
                       medications and new prescription.

    Returns:
        Parsed dict matching the InteractionCheckResult schema fields:
        risk_level, confidence_score, interactions_found, recommendation, reasoning.
    """
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    knowledge_base = _get_knowledge_base()

    system = SYSTEM_PROMPT.format(
        knowledge_base=json.dumps(knowledge_base, indent=2)
    )

    user_message = f"""Analyze the following prescription for potential drug interactions:

Patient ID: {masked_payload['patient_id']}
Age Range: {masked_payload['age_range']}
Weight Range: {masked_payload['weight_range']}
Allergy Categories: {json.dumps(masked_payload['allergy_categories'])}

Current Medications:
{json.dumps(masked_payload['current_medications'], indent=2)}

New Prescription:
{json.dumps(masked_payload['new_prescription'], indent=2)}

Identify all potential interactions between the NEW prescription and EACH current medication.
Also check if the new prescription conflicts with the patient's allergy categories."""

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2000,
        system=system,
        messages=[{"role": "user", "content": user_message}],
    )

    response_text = response.content[0].text

    # Strip markdown code fences if Claude includes them despite instructions
    cleaned = response_text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1]
    if cleaned.endswith("```"):
        cleaned = cleaned.rsplit("```", 1)[0]
    cleaned = cleaned.strip()

    result = json.loads(cleaned)

    # Validate required fields exist
    required = ["risk_level", "confidence_score", "interactions_found", "recommendation", "reasoning"]
    for field in required:
        if field not in result:
            raise ValueError(f"AI response missing required field: {field}")

    # Clamp confidence score to valid range
    result["confidence_score"] = max(0.0, min(1.0, float(result["confidence_score"])))

    return result
