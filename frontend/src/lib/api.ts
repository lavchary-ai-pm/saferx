import type {
  PatientSummary,
  Patient,
  PrescriptionCreate,
  Prescription,
  MaskingComparison,
  InteractionCheckResult,
  QueueItem,
  ReviewCreate,
  AuditEntry,
  AnalyticsSummary,
  ThresholdSimulationResponse,
  CostROIResponse,
} from "@/types";

const BASE = import.meta.env.VITE_API_URL || "/api";

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function getPatients(): Promise<PatientSummary[]> {
  return fetchJson("/patients");
}

export async function getPatient(id: string): Promise<Patient> {
  return fetchJson(`/patients/${id}`);
}

export async function submitPrescription(
  data: PrescriptionCreate
): Promise<Prescription> {
  return fetchJson("/prescriptions", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getMaskingView(
  prescriptionId: string
): Promise<MaskingComparison> {
  return fetchJson(`/prescriptions/${prescriptionId}/masking`);
}

export async function runInteractionCheck(
  prescriptionId: string
): Promise<InteractionCheckResult> {
  return fetchJson(`/prescriptions/${prescriptionId}/check`, {
    method: "POST",
  });
}

export async function getReviewQueue(): Promise<{
  items: QueueItem[];
  count: number;
}> {
  return fetchJson("/queue");
}

export async function getQueueItem(checkId: string): Promise<QueueItem> {
  return fetchJson(`/queue/${checkId}`);
}

export async function submitReview(
  checkId: string,
  data: ReviewCreate
): Promise<{ review: unknown; prescription_status: string; ai_pharmacist_agreement: boolean }> {
  return fetchJson(`/reviews/${checkId}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getAuditLog(params?: {
  risk_level?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ entries: AuditEntry[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params?.risk_level) searchParams.set("risk_level", params.risk_level);
  if (params?.status) searchParams.set("status", params.status);
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.offset) searchParams.set("offset", String(params.offset));
  const qs = searchParams.toString();
  return fetchJson(`/audit${qs ? `?${qs}` : ""}`);
}

export function getAuditExportUrl(): string {
  return `${BASE}/audit/export`;
}

export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  return fetchJson("/analytics/summary");
}

export async function getThresholdSimulation(): Promise<ThresholdSimulationResponse> {
  return fetchJson("/analytics/threshold-simulation");
}

export async function getCostROI(): Promise<CostROIResponse> {
  return fetchJson("/analytics/cost-roi");
}
