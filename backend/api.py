"""FastAPI backend for SafeRx - AI Medication Interaction Review."""

import json
import os
import uuid

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse

from src.database import init_db, get_db
from src.models import (
    Patient, PatientMedication, PatientSummary,
    PrescriptionCreate, Prescription, PrescriptionStatus,
    InteractionCheckResult, InteractionFound, MaskingComparison,
    RawPayload, MaskedPayload,
    ReviewCreate, PharmacistReview, QueueItem, ReviewDecision,
    AnalyticsSummary, ThresholdSimulationResult, ThresholdSimulationResponse,
    CostBreakdown, ROIAnalysis, CostProjection, DataSources, CostROIResponse,
)
from src.masking import mask_patient_data
from src.interaction_checker import check_interactions
from src.router import route_prescription
from src.audit import log_decision, update_audit_with_review, get_audit_log, get_audit_count, export_audit_csv
from src.feedback import save_review, get_review_for_check

load_dotenv()

app = FastAPI(
    title="SafeRx - AI Medication Interaction Review",
    description="AI-powered medication interaction checker with human-in-the-loop pharmacist review.",
    version="0.1.0",
)

# CORS configuration for local development
cors_origins = [
    "http://localhost:5173",
    "http://localhost:3000",
]
if os.getenv("FRONTEND_URL"):
    cors_origins.append(os.getenv("FRONTEND_URL"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    init_db()


# --- Health Check ---

@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "saferx"}


# --- Patient Endpoints ---

@app.get("/api/patients", response_model=list[PatientSummary])
def list_patients():
    """List all patients with their medication counts."""
    db = get_db()
    rows = db.execute("""
        SELECT p.id, p.name, p.date_of_birth, COUNT(pm.id) as medication_count
        FROM patients p
        LEFT JOIN patient_medications pm ON p.id = pm.patient_id AND pm.active = 1
        GROUP BY p.id
        ORDER BY p.name
    """).fetchall()
    db.close()

    return [
        PatientSummary(
            id=row["id"],
            name=row["name"],
            date_of_birth=row["date_of_birth"],
            medication_count=row["medication_count"],
        )
        for row in rows
    ]


@app.get("/api/patients/{patient_id}", response_model=Patient)
def get_patient(patient_id: str):
    """Get a single patient with full medication details."""
    db = get_db()

    patient_row = db.execute(
        "SELECT * FROM patients WHERE id = ?", (patient_id,)
    ).fetchone()

    if not patient_row:
        db.close()
        raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found")

    med_rows = db.execute(
        "SELECT * FROM patient_medications WHERE patient_id = ? AND active = 1",
        (patient_id,),
    ).fetchall()

    db.close()

    return Patient(
        id=patient_row["id"],
        name=patient_row["name"],
        date_of_birth=patient_row["date_of_birth"],
        weight_kg=patient_row["weight_kg"],
        allergies=json.loads(patient_row["allergies"]),
        medications=[
            PatientMedication(
                id=med["id"],
                medication_name=med["medication_name"],
                dosage=med["dosage"],
                frequency=med["frequency"],
                prescriber=med["prescriber"],
                start_date=med["start_date"],
            )
            for med in med_rows
        ],
    )


# --- Helper: load patient with medications as a dict ---

def _get_patient_dict(patient_id: str) -> dict:
    """Load a patient with medications as a plain dict (for masking module)."""
    db = get_db()
    patient_row = db.execute(
        "SELECT * FROM patients WHERE id = ?", (patient_id,)
    ).fetchone()

    if not patient_row:
        db.close()
        raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found")

    med_rows = db.execute(
        "SELECT * FROM patient_medications WHERE patient_id = ? AND active = 1",
        (patient_id,),
    ).fetchall()
    db.close()

    return {
        "id": patient_row["id"],
        "name": patient_row["name"],
        "date_of_birth": patient_row["date_of_birth"],
        "weight_kg": patient_row["weight_kg"],
        "allergies": patient_row["allergies"],
        "medications": [dict(med) for med in med_rows],
    }


# --- Prescription Endpoints ---

@app.post("/api/prescriptions", response_model=Prescription)
def submit_prescription(rx: PrescriptionCreate):
    """Submit a new prescription for interaction checking."""
    # Verify the patient exists
    db = get_db()
    patient = db.execute(
        "SELECT id FROM patients WHERE id = ?", (rx.patient_id,)
    ).fetchone()

    if not patient:
        db.close()
        raise HTTPException(status_code=404, detail=f"Patient {rx.patient_id} not found")

    prescription_id = f"RX-{uuid.uuid4().hex[:8].upper()}"

    db.execute(
        """INSERT INTO prescriptions (id, patient_id, medication_name, dosage, frequency, prescriber, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (
            prescription_id,
            rx.patient_id,
            rx.medication_name,
            rx.dosage,
            rx.frequency,
            rx.prescriber,
            PrescriptionStatus.PENDING.value,
        ),
    )
    db.commit()

    row = db.execute(
        "SELECT * FROM prescriptions WHERE id = ?", (prescription_id,)
    ).fetchone()
    db.close()

    return Prescription(
        id=row["id"],
        patient_id=row["patient_id"],
        medication_name=row["medication_name"],
        dosage=row["dosage"],
        frequency=row["frequency"],
        prescriber=row["prescriber"],
        status=row["status"],
        created_at=row["created_at"],
    )


@app.get("/api/prescriptions/{prescription_id}/masking", response_model=MaskingComparison)
def get_masking_view(prescription_id: str):
    """Get the before/after masking comparison for the UI visualization."""
    db = get_db()
    rx_row = db.execute(
        "SELECT * FROM prescriptions WHERE id = ?", (prescription_id,)
    ).fetchone()

    if not rx_row:
        db.close()
        raise HTTPException(status_code=404, detail=f"Prescription {prescription_id} not found")
    db.close()

    patient = _get_patient_dict(rx_row["patient_id"])
    prescription = {
        "id": rx_row["id"],
        "medication_name": rx_row["medication_name"],
        "dosage": rx_row["dosage"],
        "frequency": rx_row["frequency"],
        "prescriber": rx_row["prescriber"],
    }

    result = mask_patient_data(patient, prescription)

    return MaskingComparison(
        raw=RawPayload(**result["raw"]),
        masked=MaskedPayload(**result["masked"]),
    )


@app.post("/api/prescriptions/{prescription_id}/check", response_model=InteractionCheckResult)
def run_interaction_check(prescription_id: str):
    """Run the full AI interaction check pipeline.

    Flow: load patient -> mask PHI -> call Claude -> route decision -> save + audit.
    """
    db = get_db()
    rx_row = db.execute(
        "SELECT * FROM prescriptions WHERE id = ?", (prescription_id,)
    ).fetchone()

    if not rx_row:
        db.close()
        raise HTTPException(status_code=404, detail=f"Prescription {prescription_id} not found")

    # Update status to checking
    db.execute(
        "UPDATE prescriptions SET status = ? WHERE id = ?",
        (PrescriptionStatus.CHECKING.value, prescription_id),
    )
    db.commit()
    db.close()

    # Step 1: Load patient data
    patient = _get_patient_dict(rx_row["patient_id"])
    prescription = {
        "id": rx_row["id"],
        "medication_name": rx_row["medication_name"],
        "dosage": rx_row["dosage"],
        "frequency": rx_row["frequency"],
        "prescriber": rx_row["prescriber"],
    }

    # Step 2: Mask PHI
    masking_result = mask_patient_data(patient, prescription)
    masked = masking_result["masked"]
    raw = masking_result["raw"]

    # Step 3: Call Claude for interaction analysis
    ai_result = check_interactions(masked)

    # Step 4: Route based on confidence + risk
    routing_decision = route_prescription(ai_result)

    # Step 5: Save interaction check to database
    check_id = f"CHK-{uuid.uuid4().hex[:8].upper()}"

    db = get_db()
    db.execute(
        """INSERT INTO interaction_checks
        (id, prescription_id, risk_level, confidence_score, interactions_found,
         recommendation, reasoning, masked_payload, raw_payload, routing_decision)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            check_id,
            prescription_id,
            ai_result["risk_level"],
            ai_result["confidence_score"],
            json.dumps(ai_result["interactions_found"]),
            ai_result["recommendation"],
            ai_result["reasoning"],
            json.dumps(masking_result["masked"]),
            json.dumps(masking_result["raw"]),
            routing_decision,
        ),
    )

    # Step 6: Update prescription status based on routing
    if routing_decision == "auto_approved":
        new_status = PrescriptionStatus.APPROVED.value
    else:
        new_status = PrescriptionStatus.IN_REVIEW.value

    db.execute(
        "UPDATE prescriptions SET status = ? WHERE id = ?",
        (new_status, prescription_id),
    )
    db.commit()

    row = db.execute(
        "SELECT * FROM interaction_checks WHERE id = ?", (check_id,)
    ).fetchone()
    db.close()

    # Step 7: Log to audit trail
    masked_patient_id = masked["patient_id"]
    log_decision(
        patient_id_masked=masked_patient_id,
        prescription_id=prescription_id,
        medication_name=rx_row["medication_name"],
        ai_recommendation=ai_result["recommendation"],
        ai_confidence=ai_result["confidence_score"],
        ai_risk_level=ai_result["risk_level"],
        final_status=new_status,
    )

    return InteractionCheckResult(
        id=row["id"],
        prescription_id=row["prescription_id"],
        risk_level=row["risk_level"],
        confidence_score=row["confidence_score"],
        interactions_found=[
            InteractionFound(**i)
            for i in json.loads(row["interactions_found"])
        ],
        recommendation=row["recommendation"],
        reasoning=row["reasoning"],
        routing_decision=row["routing_decision"],
        masked_payload=MaskedPayload(**json.loads(row["masked_payload"])),
        raw_payload=RawPayload(**json.loads(row["raw_payload"])),
        created_at=row["created_at"],
    )


# --- Audit Log Endpoints ---

@app.get("/api/audit")
def get_audit(
    risk_level: str | None = None,
    status: str | None = None,
    limit: int = 100,
    offset: int = 0,
):
    """Get audit log entries with optional filters."""
    entries = get_audit_log(
        risk_level=risk_level,
        status=status,
        limit=limit,
        offset=offset,
    )
    total = get_audit_count(risk_level=risk_level, status=status)
    return {"entries": entries, "total": total}


@app.get("/api/audit/export")
def export_audit():
    """Export the full audit log as CSV."""
    csv_content = export_audit_csv()
    return PlainTextResponse(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=saferx_audit_log.csv"},
    )


# --- Pharmacist Review Queue Endpoints ---

@app.get("/api/queue")
def get_review_queue():
    """Get all prescriptions waiting for pharmacist review.

    Returns combined view: prescription + patient + AI analysis for each item.
    """
    db = get_db()

    # Get all interaction checks that were routed to pharmacist
    # and whose prescriptions are still in_review
    checks = db.execute("""
        SELECT ic.*, p.status as rx_status
        FROM interaction_checks ic
        JOIN prescriptions p ON ic.prescription_id = p.id
        WHERE ic.routing_decision = 'routed_to_pharmacist'
        AND p.status = 'in_review'
        ORDER BY ic.created_at DESC
    """).fetchall()

    queue_items = []
    for check in checks:
        # Get prescription
        rx = db.execute(
            "SELECT * FROM prescriptions WHERE id = ?",
            (check["prescription_id"],),
        ).fetchone()

        # Get patient
        patient_row = db.execute(
            "SELECT * FROM patients WHERE id = ?",
            (rx["patient_id"],),
        ).fetchone()

        med_rows = db.execute(
            "SELECT * FROM patient_medications WHERE patient_id = ? AND active = 1",
            (rx["patient_id"],),
        ).fetchall()

        # Check if already reviewed
        existing_review = get_review_for_check(check["id"])

        queue_items.append({
            "prescription": {
                "id": rx["id"],
                "patient_id": rx["patient_id"],
                "medication_name": rx["medication_name"],
                "dosage": rx["dosage"],
                "frequency": rx["frequency"],
                "prescriber": rx["prescriber"],
                "status": rx["status"],
                "created_at": rx["created_at"],
            },
            "patient": {
                "id": patient_row["id"],
                "name": patient_row["name"],
                "date_of_birth": patient_row["date_of_birth"],
                "weight_kg": patient_row["weight_kg"],
                "allergies": json.loads(patient_row["allergies"]),
                "medications": [
                    {
                        "id": med["id"],
                        "medication_name": med["medication_name"],
                        "dosage": med["dosage"],
                        "frequency": med["frequency"],
                        "prescriber": med["prescriber"],
                        "start_date": med["start_date"],
                    }
                    for med in med_rows
                ],
            },
            "interaction_check": {
                "id": check["id"],
                "prescription_id": check["prescription_id"],
                "risk_level": check["risk_level"],
                "confidence_score": check["confidence_score"],
                "interactions_found": json.loads(check["interactions_found"]),
                "recommendation": check["recommendation"],
                "reasoning": check["reasoning"],
                "routing_decision": check["routing_decision"],
                "masked_payload": json.loads(check["masked_payload"]),
                "raw_payload": json.loads(check["raw_payload"]),
                "created_at": check["created_at"],
            },
            "review": existing_review,
        })

    db.close()
    return {"items": queue_items, "count": len(queue_items)}


@app.get("/api/queue/{check_id}")
def get_queue_item(check_id: str):
    """Get a single review queue item with full details."""
    db = get_db()

    check = db.execute(
        "SELECT * FROM interaction_checks WHERE id = ?", (check_id,)
    ).fetchone()

    if not check:
        db.close()
        raise HTTPException(status_code=404, detail=f"Interaction check {check_id} not found")

    rx = db.execute(
        "SELECT * FROM prescriptions WHERE id = ?",
        (check["prescription_id"],),
    ).fetchone()

    patient_row = db.execute(
        "SELECT * FROM patients WHERE id = ?",
        (rx["patient_id"],),
    ).fetchone()

    med_rows = db.execute(
        "SELECT * FROM patient_medications WHERE patient_id = ? AND active = 1",
        (rx["patient_id"],),
    ).fetchall()
    db.close()

    existing_review = get_review_for_check(check_id)

    return {
        "prescription": {
            "id": rx["id"],
            "patient_id": rx["patient_id"],
            "medication_name": rx["medication_name"],
            "dosage": rx["dosage"],
            "frequency": rx["frequency"],
            "prescriber": rx["prescriber"],
            "status": rx["status"],
            "created_at": rx["created_at"],
        },
        "patient": {
            "id": patient_row["id"],
            "name": patient_row["name"],
            "date_of_birth": patient_row["date_of_birth"],
            "weight_kg": patient_row["weight_kg"],
            "allergies": json.loads(patient_row["allergies"]),
            "medications": [
                {
                    "id": med["id"],
                    "medication_name": med["medication_name"],
                    "dosage": med["dosage"],
                    "frequency": med["frequency"],
                    "prescriber": med["prescriber"],
                    "start_date": med["start_date"],
                }
                for med in med_rows
            ],
        },
        "interaction_check": {
            "id": check["id"],
            "prescription_id": check["prescription_id"],
            "risk_level": check["risk_level"],
            "confidence_score": check["confidence_score"],
            "interactions_found": json.loads(check["interactions_found"]),
            "recommendation": check["recommendation"],
            "reasoning": check["reasoning"],
            "routing_decision": check["routing_decision"],
            "masked_payload": json.loads(check["masked_payload"]),
            "raw_payload": json.loads(check["raw_payload"]),
            "created_at": check["created_at"],
        },
        "review": existing_review,
    }


@app.post("/api/reviews/{check_id}")
def submit_review(check_id: str, review: ReviewCreate):
    """Submit a pharmacist's review decision for an interaction check.

    Updates: pharmacist_reviews table, prescription status, and audit log.
    """
    db = get_db()

    # Verify the interaction check exists
    check = db.execute(
        "SELECT * FROM interaction_checks WHERE id = ?", (check_id,)
    ).fetchone()

    if not check:
        db.close()
        raise HTTPException(status_code=404, detail=f"Interaction check {check_id} not found")

    # Check if already reviewed
    existing = get_review_for_check(check_id)
    if existing:
        db.close()
        raise HTTPException(status_code=409, detail="This prescription has already been reviewed")

    db.close()

    # Save the pharmacist review
    review_record = save_review(
        interaction_check_id=check_id,
        decision=review.decision,
        agrees_with_ai=review.agrees_with_ai,
        feedback_text=review.feedback_text,
        time_to_decision_seconds=review.time_to_decision_seconds,
    )

    # Update prescription status
    prescription_id = check["prescription_id"]
    new_status = review.decision  # approved, rejected, or escalated

    db = get_db()
    db.execute(
        "UPDATE prescriptions SET status = ? WHERE id = ?",
        (new_status, prescription_id),
    )
    db.commit()
    db.close()

    # Determine if pharmacist agreed with AI
    # AI said reject/pharmacist_review -> pharmacist rejected = agreement
    # AI said auto_approve -> pharmacist approved = agreement
    ai_recommendation = check["recommendation"]
    ai_would_approve = ai_recommendation == "auto_approve"
    pharmacist_approved = review.decision == "approved"

    # Use explicit feedback if provided, otherwise infer from decision
    agreement = review.agrees_with_ai
    if agreement is None:
        agreement = ai_would_approve == pharmacist_approved

    # Update audit log with pharmacist decision
    update_audit_with_review(
        prescription_id=prescription_id,
        pharmacist_decision=review.decision,
        pharmacist_feedback=review.feedback_text,
        ai_pharmacist_agreement=agreement,
        time_to_decision_seconds=review.time_to_decision_seconds,
        final_status=new_status,
    )

    return {
        "review": review_record,
        "prescription_status": new_status,
        "ai_pharmacist_agreement": agreement,
    }


# --- Analytics Endpoints ---

@app.get("/api/analytics/summary", response_model=AnalyticsSummary)
def get_analytics_summary():
    """Aggregate metrics from the audit log for the dashboard.

    Computes: total prescriptions, auto-approve rate, override rate,
    average confidence, average review time, risk distribution.
    """
    db = get_db()

    # Total entries in the audit log
    total = db.execute("SELECT COUNT(*) as cnt FROM audit_log").fetchone()["cnt"]

    if total == 0:
        db.close()
        return AnalyticsSummary(
            total_prescriptions=0,
            auto_approved_count=0,
            pharmacist_reviewed_count=0,
            auto_approve_rate=0.0,
            override_rate=0.0,
            average_confidence=0.0,
            average_time_to_decision_seconds=None,
            risk_distribution={"low": 0, "medium": 0, "high": 0, "critical": 0},
        )

    # Count auto-approved (final_status = 'approved' AND no pharmacist decision)
    auto_approved = db.execute(
        "SELECT COUNT(*) as cnt FROM audit_log WHERE pharmacist_decision IS NULL AND final_status = 'approved'"
    ).fetchone()["cnt"]

    # Count pharmacist-reviewed (pharmacist_decision IS NOT NULL)
    pharmacist_reviewed = db.execute(
        "SELECT COUNT(*) as cnt FROM audit_log WHERE pharmacist_decision IS NOT NULL"
    ).fetchone()["cnt"]

    # Override rate: pharmacist disagreed with AI / total pharmacist reviews
    overrides = db.execute(
        "SELECT COUNT(*) as cnt FROM audit_log WHERE ai_pharmacist_agreement = 0"
    ).fetchone()["cnt"]
    override_rate = overrides / pharmacist_reviewed if pharmacist_reviewed > 0 else 0.0

    # Average AI confidence
    avg_conf = db.execute(
        "SELECT AVG(ai_confidence) as avg_c FROM audit_log WHERE ai_confidence IS NOT NULL"
    ).fetchone()["avg_c"] or 0.0

    # Average time to decision (pharmacist reviews only)
    avg_time_row = db.execute(
        "SELECT AVG(time_to_decision_seconds) as avg_t FROM audit_log WHERE time_to_decision_seconds IS NOT NULL"
    ).fetchone()
    avg_time = avg_time_row["avg_t"]

    # Risk distribution
    risk_rows = db.execute(
        "SELECT ai_risk_level, COUNT(*) as cnt FROM audit_log WHERE ai_risk_level IS NOT NULL GROUP BY ai_risk_level"
    ).fetchall()

    risk_dist = {"low": 0, "medium": 0, "high": 0, "critical": 0}
    for row in risk_rows:
        risk_dist[row["ai_risk_level"]] = row["cnt"]

    db.close()

    return AnalyticsSummary(
        total_prescriptions=total,
        auto_approved_count=auto_approved,
        pharmacist_reviewed_count=pharmacist_reviewed,
        auto_approve_rate=auto_approved / total if total > 0 else 0.0,
        override_rate=override_rate,
        average_confidence=round(avg_conf, 3),
        average_time_to_decision_seconds=round(avg_time, 1) if avg_time else None,
        risk_distribution=risk_dist,
    )


@app.get("/api/analytics/threshold-simulation", response_model=ThresholdSimulationResponse)
def simulate_thresholds():
    """Simulate different confidence thresholds using historical data.

    Sweeps from 80% to 99% confidence and calculates for each threshold:
    - How many prescriptions would be auto-approved
    - How many would go to pharmacist queue
    - Estimated false negatives (dangerous Rx that slip through)
    - Pharmacist hours/day (assuming 5 min per review, 50 Rx/day)
    """
    # Load historical records
    data_path = os.path.join(os.path.dirname(__file__), "data", "historical_records.json")
    with open(data_path) as f:
        records = json.load(f)

    total = len(records)
    current_threshold = 0.95  # Our production threshold

    # Sweep thresholds from 0.80 to 0.99 in 0.01 steps
    simulations = []
    for pct in range(80, 100):
        threshold = pct / 100.0

        auto_approved = 0
        false_negatives = 0

        for rec in records:
            # Apply routing logic: auto-approve if confidence >= threshold AND risk is low
            would_auto_approve = (
                rec["confidence_score"] >= threshold
                and rec["risk_level"] == "low"
            )

            if would_auto_approve:
                auto_approved += 1
                # False negative: auto-approved but actually dangerous
                if rec["ground_truth_dangerous"]:
                    false_negatives += 1

        routed = total - auto_approved
        fn_rate = false_negatives / total if total > 0 else 0.0

        # Pharmacist hours/day estimate:
        # Assume ~50 prescriptions/day proportionally, 5 min per review
        daily_proportion = 50 / total if total > 0 else 0
        daily_routed = routed * daily_proportion
        pharmacist_hours = (daily_routed * 5) / 60  # 5 min per review -> hours

        simulations.append(ThresholdSimulationResult(
            threshold=threshold,
            auto_approved_count=auto_approved,
            routed_to_pharmacist_count=routed,
            estimated_false_negatives=false_negatives,
            false_negative_rate=round(fn_rate, 4),
            pharmacist_hours_per_day=round(pharmacist_hours, 2),
        ))

    return ThresholdSimulationResponse(
        current_threshold=current_threshold,
        simulations=simulations,
    )


# ── Cost & ROI ──────────────────────────────────────────────────────────


@app.get("/api/analytics/cost-roi", response_model=CostROIResponse)
def get_cost_roi():
    """Calculate AI cost breakdown and ROI analysis.

    Uses Claude Sonnet pricing, estimated token usage, and pharmacist
    labor costs to show the financial case for AI-assisted review.
    """
    # Cost constants
    MODEL_NAME = "claude-sonnet-4-20250514"
    INPUT_PRICE_PER_MILLION = 3.00
    OUTPUT_PRICE_PER_MILLION = 15.00
    AVG_INPUT_TOKENS = 5750
    AVG_OUTPUT_TOKENS = 600
    PHARMACIST_HOURLY_RATE = 65.00
    AVG_REVIEW_MINUTES = 5.0
    PROJECTION_VOLUMES = [25, 50, 100, 200, 500]

    # Derived constants
    cost_per_check = (
        (AVG_INPUT_TOKENS * INPUT_PRICE_PER_MILLION / 1_000_000)
        + (AVG_OUTPUT_TOKENS * OUTPUT_PRICE_PER_MILLION / 1_000_000)
    )
    pharmacist_cost_per_review = PHARMACIST_HOURLY_RATE * (AVG_REVIEW_MINUTES / 60)

    # --- Live data from audit_log ---
    db = get_db()
    cursor = db.cursor()

    cursor.execute("SELECT COUNT(*) FROM audit_log")
    live_total = cursor.fetchone()[0]

    cursor.execute(
        "SELECT COUNT(*) FROM audit_log WHERE final_status = 'approved' AND pharmacist_decision IS NULL"
    )
    live_auto_approved = cursor.fetchone()[0]

    live_pharmacist_reviewed = live_total - live_auto_approved

    # --- Historical data ---
    data_path = os.path.join(os.path.dirname(__file__), "data", "historical_records.json")
    with open(data_path) as f:
        historical = json.load(f)

    hist_total = len(historical)
    hist_auto_approved = sum(
        1 for r in historical if r["routing_decision"] == "auto_approved"
    )

    # --- Combined metrics ---
    combined_total = live_total + hist_total
    combined_auto_approved = live_auto_approved + hist_auto_approved
    combined_pharmacist_reviewed = combined_total - combined_auto_approved
    auto_approve_rate = combined_auto_approved / combined_total if combined_total > 0 else 0.0

    # --- Section 1: Cost Breakdown ---
    cost_breakdown = CostBreakdown(
        model_name=MODEL_NAME,
        input_price_per_million=INPUT_PRICE_PER_MILLION,
        output_price_per_million=OUTPUT_PRICE_PER_MILLION,
        avg_input_tokens_per_check=AVG_INPUT_TOKENS,
        avg_output_tokens_per_check=AVG_OUTPUT_TOKENS,
        cost_per_check=round(cost_per_check, 4),
        total_checks_live=live_total,
        total_ai_cost_live=round(live_total * cost_per_check, 2),
        total_checks_historical=hist_total,
        total_ai_cost_historical=round(hist_total * cost_per_check, 2),
        projected_monthly_cost_50_per_day=round(50 * 30 * cost_per_check, 2),
    )

    # --- Section 2: ROI Analysis ---
    cost_without_ai = round(combined_total * pharmacist_cost_per_review, 2)
    pharmacist_cost_with_ai = round(combined_pharmacist_reviewed * pharmacist_cost_per_review, 2)
    total_ai_cost = round(combined_total * cost_per_check, 2)
    total_cost_with_ai = round(pharmacist_cost_with_ai + total_ai_cost, 2)
    total_savings = round(cost_without_ai - total_cost_with_ai, 2)
    roi_pct = round((total_savings / total_ai_cost) * 100, 1) if total_ai_cost > 0 else 0.0
    hours_saved = round(combined_auto_approved * AVG_REVIEW_MINUTES / 60, 1)

    roi_analysis = ROIAnalysis(
        pharmacist_hourly_rate=PHARMACIST_HOURLY_RATE,
        avg_review_time_minutes=AVG_REVIEW_MINUTES,
        pharmacist_cost_per_review=round(pharmacist_cost_per_review, 2),
        total_prescriptions=combined_total,
        auto_approved_count=combined_auto_approved,
        pharmacist_reviewed_count=combined_pharmacist_reviewed,
        auto_approve_rate=round(auto_approve_rate, 4),
        cost_without_ai=cost_without_ai,
        pharmacist_cost_with_ai=pharmacist_cost_with_ai,
        total_ai_cost=total_ai_cost,
        total_cost_with_ai=total_cost_with_ai,
        total_savings=total_savings,
        roi_percentage=roi_pct,
        pharmacist_hours_saved=hours_saved,
    )

    # --- Section 3: Projections ---
    projections = []
    for daily in PROJECTION_VOLUMES:
        monthly_rx = daily * 30
        m_ai_cost = round(monthly_rx * cost_per_check, 2)
        m_pharm_without = round(monthly_rx * pharmacist_cost_per_review, 2)
        m_auto = round(monthly_rx * auto_approve_rate)
        m_pharm_reviewed = monthly_rx - m_auto
        m_pharm_with = round(m_pharm_reviewed * pharmacist_cost_per_review, 2)
        m_total_with = round(m_pharm_with + m_ai_cost, 2)
        m_savings = round(m_pharm_without - m_total_with, 2)

        projections.append(CostProjection(
            daily_volume=daily,
            monthly_prescriptions=monthly_rx,
            monthly_ai_cost=m_ai_cost,
            monthly_pharmacist_cost_without_ai=m_pharm_without,
            monthly_pharmacist_cost_with_ai=m_pharm_with,
            monthly_total_cost_with_ai=m_total_with,
            monthly_net_savings=m_savings,
        ))

    return CostROIResponse(
        cost_breakdown=cost_breakdown,
        roi_analysis=roi_analysis,
        projections=projections,
        data_sources=DataSources(
            live_prescription_count=live_total,
            historical_record_count=hist_total,
        ),
    )
