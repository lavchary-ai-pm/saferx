import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { PrescriptionForm } from "@/components/prescription/PrescriptionForm";
import { MaskingView } from "@/components/masking/MaskingView";
import { RiskBadge } from "@/components/review/RiskBadge";
import { ConfidenceGauge } from "@/components/review/ConfidenceGauge";
import {
  submitPrescription,
  getMaskingView,
  runInteractionCheck,
} from "@/lib/api";
import type {
  PrescriptionCreate,
  Prescription,
  MaskingComparison,
  InteractionCheckResult,
} from "@/types";

type FlowStep = "form" | "masking" | "checking" | "result";

export function SubmitPage() {
  const [step, setStep] = useState<FlowStep>("form");
  const [submitting, setSubmitting] = useState(false);
  const [prescription, setPrescription] = useState<Prescription | null>(null);
  const [masking, setMasking] = useState<MaskingComparison | null>(null);
  const [checkResult, setCheckResult] = useState<InteractionCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(data: PrescriptionCreate) {
    setError(null);
    setSubmitting(true);

    try {
      // Step 1: Submit prescription
      const rx = await submitPrescription(data);
      setPrescription(rx);

      // Step 2: Get masking view
      const maskData = await getMaskingView(rx.id);
      setMasking(maskData);
      setStep("masking");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit prescription");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRunCheck() {
    if (!prescription) return;
    setStep("checking");
    setError(null);

    try {
      const result = await runInteractionCheck(prescription.id);
      setCheckResult(result);
      setStep("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI check failed");
      setStep("masking");
    }
  }

  function handleReset() {
    setStep("form");
    setPrescription(null);
    setMasking(null);
    setCheckResult(null);
    setError(null);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Submit Prescription</h2>
        <p className="text-muted-foreground mt-1">
          Submit a new prescription to check for drug interactions
        </p>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center gap-2 text-sm">
        <StepIndicator label="1. Submit" active={step === "form"} done={step !== "form"} />
        <ArrowRight className="h-3 w-3 text-muted-foreground" />
        <StepIndicator label="2. PHI Masking" active={step === "masking"} done={step === "checking" || step === "result"} />
        <ArrowRight className="h-3 w-3 text-muted-foreground" />
        <StepIndicator label="3. AI Analysis" active={step === "checking"} done={step === "result"} />
        <ArrowRight className="h-3 w-3 text-muted-foreground" />
        <StepIndicator label="4. Result" active={step === "result"} done={false} />
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Step 1: Form */}
      {step === "form" && (
        <PrescriptionForm onSubmit={handleSubmit} loading={submitting} />
      )}

      {/* Step 2: Masking View */}
      {step === "masking" && masking && (
        <div className="space-y-4">
          <MaskingView data={masking} />
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleReset}>
              Start Over
            </Button>
            <Button onClick={handleRunCheck}>
              Run AI Interaction Check
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Checking */}
      {step === "checking" && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
            <p className="text-lg font-medium">Analyzing Interactions...</p>
            <p className="text-sm text-muted-foreground mt-1">
              Claude Sonnet is reviewing the prescription against the drug
              interaction knowledge base
            </p>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Result */}
      {step === "result" && checkResult && (
        <div className="space-y-4">
          <ResultCard result={checkResult} />
          <Button variant="outline" onClick={handleReset}>
            Submit Another Prescription
          </Button>
        </div>
      )}
    </div>
  );
}

function StepIndicator({
  label,
  active,
  done,
}: {
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <span
      className={`px-2 py-1 rounded text-xs font-medium ${
        active
          ? "bg-blue-100 text-blue-800"
          : done
          ? "bg-green-100 text-green-800"
          : "bg-muted text-muted-foreground"
      }`}
    >
      {done ? "✓ " : ""}
      {label}
    </span>
  );
}

function ResultCard({ result }: { result: InteractionCheckResult }) {
  const isAutoApproved = result.routing_decision === "auto_approved";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-3">
              {isAutoApproved ? (
                <CheckCircle className="h-6 w-6 text-green-600" />
              ) : result.risk_level === "critical" ? (
                <XCircle className="h-6 w-6 text-red-600" />
              ) : (
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
              )}
              Interaction Analysis Complete
            </CardTitle>
            <CardDescription className="mt-1">
              {isAutoApproved
                ? "This prescription was auto-approved (low risk, high confidence)"
                : "This prescription has been routed to the pharmacist review queue"}
            </CardDescription>
          </div>
          <ConfidenceGauge score={result.confidence_score} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <RiskBadge level={result.risk_level} />
          <Badge variant="outline">
            AI recommends: {result.recommendation.replace("_", " ")}
          </Badge>
          <Badge
            variant="outline"
            className={
              isAutoApproved
                ? "bg-green-50 text-green-700 border-green-300"
                : "bg-yellow-50 text-yellow-700 border-yellow-300"
            }
          >
            {isAutoApproved ? "Auto-Approved" : "Routed to Pharmacist"}
          </Badge>
        </div>

        {result.interactions_found.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="font-medium mb-2">
                Interactions Found ({result.interactions_found.length})
              </h4>
              <div className="space-y-3">
                {result.interactions_found.map((interaction, i) => (
                  <div
                    key={i}
                    className="rounded-lg border p-3 space-y-1"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {interaction.drug_a} + {interaction.drug_b}
                      </span>
                      <RiskBadge
                        level={interaction.severity}
                        size="sm"
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {interaction.description}
                    </p>
                    {interaction.mechanism && (
                      <p className="text-xs text-muted-foreground">
                        <strong>Mechanism:</strong> {interaction.mechanism}
                      </p>
                    )}
                    {interaction.recommendation && (
                      <p className="text-xs text-blue-700">
                        <strong>Recommendation:</strong>{" "}
                        {interaction.recommendation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <Separator />
        <div>
          <h4 className="font-medium mb-1">AI Reasoning</h4>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {result.reasoning}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
