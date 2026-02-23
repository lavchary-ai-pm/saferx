"""Pydantic models for SafeRx API request/response validation."""

from pydantic import BaseModel, Field
from enum import Enum


# --- Enums ---

class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class PrescriptionStatus(str, Enum):
    PENDING = "pending"
    CHECKING = "checking"
    IN_REVIEW = "in_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    ESCALATED = "escalated"


class Recommendation(str, Enum):
    AUTO_APPROVE = "auto_approve"
    PHARMACIST_REVIEW = "pharmacist_review"
    REJECT = "reject"


class RoutingDecision(str, Enum):
    AUTO_APPROVED = "auto_approved"
    ROUTED_TO_PHARMACIST = "routed_to_pharmacist"


class ReviewDecision(str, Enum):
    APPROVED = "approved"
    REJECTED = "rejected"
    ESCALATED = "escalated"


class InteractionSeverity(str, Enum):
    MINOR = "minor"
    MODERATE = "moderate"
    SEVERE = "severe"
    CRITICAL = "critical"


# --- Patient ---

class PatientMedication(BaseModel):
    id: str
    medication_name: str
    dosage: str
    frequency: str
    prescriber: str | None = None
    start_date: str | None = None


class Patient(BaseModel):
    id: str
    name: str
    date_of_birth: str
    weight_kg: float
    allergies: list[str] = []
    medications: list[PatientMedication] = []


class PatientSummary(BaseModel):
    id: str
    name: str
    date_of_birth: str
    medication_count: int


# --- Prescription ---

class PrescriptionCreate(BaseModel):
    patient_id: str
    medication_name: str
    dosage: str
    frequency: str
    prescriber: str


class Prescription(BaseModel):
    id: str
    patient_id: str
    medication_name: str
    dosage: str
    frequency: str
    prescriber: str
    status: PrescriptionStatus
    created_at: str


# --- Masking ---

class RawPayload(BaseModel):
    """Original patient data before masking - shown in the 'Raw Data' view."""
    patient_name: str
    date_of_birth: str
    weight_kg: float
    allergies: list[str]
    current_medications: list[dict]
    new_prescription: dict


class MaskedPayload(BaseModel):
    """What the AI actually sees - shown in the 'What the AI Sees' view."""
    patient_id: str
    age_range: str
    weight_range: str
    allergy_categories: list[str]
    current_medications: list[dict]
    new_prescription: dict


class MaskingComparison(BaseModel):
    """Side-by-side view for the masking visualization."""
    raw: RawPayload
    masked: MaskedPayload


# --- Interaction Check ---

class InteractionFound(BaseModel):
    drug_a: str
    drug_b: str
    severity: InteractionSeverity
    description: str
    mechanism: str | None = None
    recommendation: str | None = None


class InteractionCheckResult(BaseModel):
    id: str
    prescription_id: str
    risk_level: RiskLevel
    confidence_score: float = Field(ge=0.0, le=1.0)
    interactions_found: list[InteractionFound]
    recommendation: Recommendation
    reasoning: str
    routing_decision: RoutingDecision
    masked_payload: MaskedPayload
    raw_payload: RawPayload
    created_at: str


# --- Pharmacist Review ---

class ReviewCreate(BaseModel):
    decision: ReviewDecision
    agrees_with_ai: bool | None = None
    feedback_text: str | None = None
    time_to_decision_seconds: int | None = None


class PharmacistReview(BaseModel):
    id: str
    interaction_check_id: str
    decision: ReviewDecision
    agrees_with_ai: bool | None = None
    feedback_text: str | None = None
    time_to_decision_seconds: int | None = None
    created_at: str


# --- Review Queue Item (combined view for pharmacist dashboard) ---

class QueueItem(BaseModel):
    prescription: Prescription
    patient: Patient
    interaction_check: InteractionCheckResult
    review: PharmacistReview | None = None


# --- Audit Log ---

class AuditEntry(BaseModel):
    id: str
    timestamp: str
    patient_id_masked: str
    prescription_id: str
    medication_name: str
    ai_recommendation: str | None = None
    ai_confidence: float | None = None
    ai_risk_level: str | None = None
    pharmacist_decision: str | None = None
    pharmacist_feedback: str | None = None
    ai_pharmacist_agreement: bool | None = None
    time_to_decision_seconds: int | None = None
    final_status: str


# --- Analytics ---

class AnalyticsSummary(BaseModel):
    total_prescriptions: int
    auto_approved_count: int
    pharmacist_reviewed_count: int
    auto_approve_rate: float
    override_rate: float
    average_confidence: float
    average_time_to_decision_seconds: float | None = None
    risk_distribution: dict[str, int]


class ThresholdSimulationResult(BaseModel):
    threshold: float
    auto_approved_count: int
    routed_to_pharmacist_count: int
    estimated_false_negatives: int
    false_negative_rate: float
    pharmacist_hours_per_day: float


class ThresholdSimulationResponse(BaseModel):
    current_threshold: float
    simulations: list[ThresholdSimulationResult]


# --- Cost & ROI ---

class CostBreakdown(BaseModel):
    model_name: str
    input_price_per_million: float
    output_price_per_million: float
    avg_input_tokens_per_check: int
    avg_output_tokens_per_check: int
    cost_per_check: float
    total_checks_live: int
    total_ai_cost_live: float
    total_checks_historical: int
    total_ai_cost_historical: float
    projected_monthly_cost_50_per_day: float


class ROIAnalysis(BaseModel):
    pharmacist_hourly_rate: float
    avg_review_time_minutes: float
    pharmacist_cost_per_review: float
    total_prescriptions: int
    auto_approved_count: int
    pharmacist_reviewed_count: int
    auto_approve_rate: float
    cost_without_ai: float
    pharmacist_cost_with_ai: float
    total_ai_cost: float
    total_cost_with_ai: float
    total_savings: float
    roi_percentage: float
    pharmacist_hours_saved: float


class CostProjection(BaseModel):
    daily_volume: int
    monthly_prescriptions: int
    monthly_ai_cost: float
    monthly_pharmacist_cost_without_ai: float
    monthly_pharmacist_cost_with_ai: float
    monthly_total_cost_with_ai: float
    monthly_net_savings: float


class DataSources(BaseModel):
    live_prescription_count: int
    historical_record_count: int


class CostROIResponse(BaseModel):
    cost_breakdown: CostBreakdown
    roi_analysis: ROIAnalysis
    projections: list[CostProjection]
    data_sources: DataSources
