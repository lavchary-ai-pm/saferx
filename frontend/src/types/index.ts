export interface PatientMedication {
  id: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  prescriber: string | null;
  start_date: string | null;
}

export interface Patient {
  id: string;
  name: string;
  date_of_birth: string;
  weight_kg: number;
  allergies: string[];
  medications: PatientMedication[];
}

export interface PatientSummary {
  id: string;
  name: string;
  date_of_birth: string;
  medication_count: number;
}

export interface Prescription {
  id: string;
  patient_id: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  prescriber: string;
  status: string;
  created_at: string;
}

export interface PrescriptionCreate {
  patient_id: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  prescriber: string;
}

export interface InteractionFound {
  drug_a: string;
  drug_b: string;
  severity: "minor" | "moderate" | "severe" | "critical";
  description: string;
  mechanism: string | null;
  recommendation: string | null;
}

export interface MaskedPayload {
  patient_id: string;
  age_range: string;
  weight_range: string;
  allergy_categories: string[];
  current_medications: Record<string, unknown>[];
  new_prescription: Record<string, unknown>;
}

export interface RawPayload {
  patient_name: string;
  date_of_birth: string;
  weight_kg: number;
  allergies: string[];
  current_medications: Record<string, unknown>[];
  new_prescription: Record<string, unknown>;
}

export interface MaskingComparison {
  raw: RawPayload;
  masked: MaskedPayload;
}

export interface InteractionCheckResult {
  id: string;
  prescription_id: string;
  risk_level: "low" | "medium" | "high" | "critical";
  confidence_score: number;
  interactions_found: InteractionFound[];
  recommendation: "auto_approve" | "pharmacist_review" | "reject";
  reasoning: string;
  routing_decision: "auto_approved" | "routed_to_pharmacist";
  masked_payload: MaskedPayload;
  raw_payload: RawPayload;
  created_at: string;
}

export interface ReviewCreate {
  decision: "approved" | "rejected" | "escalated";
  agrees_with_ai: boolean | null;
  feedback_text: string | null;
  time_to_decision_seconds: number | null;
}

export interface PharmacistReview {
  id: string;
  interaction_check_id: string;
  decision: string;
  agrees_with_ai: number | null;
  feedback_text: string | null;
  time_to_decision_seconds: number | null;
  created_at: string;
}

export interface QueueItem {
  prescription: Prescription;
  patient: Patient;
  interaction_check: InteractionCheckResult;
  review: PharmacistReview | null;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  patient_id_masked: string;
  prescription_id: string;
  medication_name: string;
  ai_recommendation: string | null;
  ai_confidence: number | null;
  ai_risk_level: string | null;
  pharmacist_decision: string | null;
  pharmacist_feedback: string | null;
  ai_pharmacist_agreement: number | null;
  time_to_decision_seconds: number | null;
  final_status: string;
}

export interface AnalyticsSummary {
  total_prescriptions: number;
  auto_approved_count: number;
  pharmacist_reviewed_count: number;
  auto_approve_rate: number;
  override_rate: number;
  average_confidence: number;
  average_time_to_decision_seconds: number | null;
  risk_distribution: Record<string, number>;
}

export interface ThresholdSimulationResult {
  threshold: number;
  auto_approved_count: number;
  routed_to_pharmacist_count: number;
  estimated_false_negatives: number;
  false_negative_rate: number;
  pharmacist_hours_per_day: number;
}

export interface ThresholdSimulationResponse {
  current_threshold: number;
  simulations: ThresholdSimulationResult[];
}

export interface CostBreakdown {
  model_name: string;
  input_price_per_million: number;
  output_price_per_million: number;
  avg_input_tokens_per_check: number;
  avg_output_tokens_per_check: number;
  cost_per_check: number;
  total_checks_live: number;
  total_ai_cost_live: number;
  total_checks_historical: number;
  total_ai_cost_historical: number;
  projected_monthly_cost_50_per_day: number;
}

export interface ROIAnalysis {
  pharmacist_hourly_rate: number;
  avg_review_time_minutes: number;
  pharmacist_cost_per_review: number;
  total_prescriptions: number;
  auto_approved_count: number;
  pharmacist_reviewed_count: number;
  auto_approve_rate: number;
  cost_without_ai: number;
  pharmacist_cost_with_ai: number;
  total_ai_cost: number;
  total_cost_with_ai: number;
  total_savings: number;
  roi_percentage: number;
  pharmacist_hours_saved: number;
}

export interface CostProjection {
  daily_volume: number;
  monthly_prescriptions: number;
  monthly_ai_cost: number;
  monthly_pharmacist_cost_without_ai: number;
  monthly_pharmacist_cost_with_ai: number;
  monthly_total_cost_with_ai: number;
  monthly_net_savings: number;
}

export interface DataSources {
  live_prescription_count: number;
  historical_record_count: number;
}

export interface CostROIResponse {
  cost_breakdown: CostBreakdown;
  roi_analysis: ROIAnalysis;
  projections: CostProjection[];
  data_sources: DataSources;
}
