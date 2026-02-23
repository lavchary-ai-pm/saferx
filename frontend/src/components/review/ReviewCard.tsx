import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  User,
  Pill,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from "lucide-react";
import { RiskBadge } from "./RiskBadge";
import { ConfidenceGauge } from "./ConfidenceGauge";
import { FeedbackForm } from "./FeedbackForm";
import type { QueueItem } from "@/types";

interface ReviewCardProps {
  item: QueueItem;
  onReview: (
    checkId: string,
    data: {
      decision: "approved" | "rejected" | "escalated";
      agrees_with_ai: boolean | null;
      feedback_text: string | null;
      time_to_decision_seconds: number | null;
    }
  ) => void;
  reviewLoading?: boolean;
}

export function ReviewCard({ item, onReview, reviewLoading }: ReviewCardProps) {
  const [showReasoning, setShowReasoning] = useState(false);
  const [reviewStartTime] = useState(Date.now());

  const { patient, prescription, interaction_check: check } = item;

  const age = calculateAge(patient.date_of_birth);

  return (
    <Card className="border-l-4 border-l-transparent" style={{
      borderLeftColor:
        check.risk_level === "critical" ? "#ef4444" :
        check.risk_level === "high" ? "#f97316" :
        check.risk_level === "medium" ? "#eab308" :
        "#22c55e",
    }}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-5 w-5" />
              {prescription.medication_name} {prescription.dosage}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {prescription.frequency} - Prescribed by {prescription.prescriber}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <RiskBadge level={check.risk_level} />
            <ConfidenceGauge score={check.confidence_score} size="sm" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Patient Summary */}
        <div className="rounded-lg bg-muted/50 p-3">
          <div className="flex items-center gap-2 mb-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">Patient Summary</span>
          </div>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Name: </span>
              <span className="font-medium">{patient.name}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Age: </span>
              <span className="font-medium">{age}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Weight: </span>
              <span className="font-medium">{patient.weight_kg} kg</span>
            </div>
            <div>
              <span className="text-muted-foreground">Allergies: </span>
              <span className="font-medium">
                {patient.allergies.length > 0 ? patient.allergies.join(", ") : "None"}
              </span>
            </div>
          </div>
        </div>

        {/* Current Medications */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Pill className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">
              Current Medications ({patient.medications.length})
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {patient.medications.map((med) => (
              <Badge key={med.id} variant="secondary" className="text-xs">
                {med.medication_name} {med.dosage}
              </Badge>
            ))}
          </div>
        </div>

        <Separator />

        {/* Interactions Found */}
        <div>
          <h4 className="font-medium text-sm mb-2">
            Interactions Found ({check.interactions_found.length})
          </h4>
          {check.interactions_found.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No interactions detected.
            </p>
          ) : (
            <div className="space-y-2">
              {check.interactions_found.map((interaction, i) => (
                <div
                  key={i}
                  className="rounded-lg border p-3 space-y-1"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {interaction.drug_a} + {interaction.drug_b}
                    </span>
                    <RiskBadge level={interaction.severity} size="sm" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {interaction.description}
                  </p>
                  {interaction.recommendation && (
                    <p className="text-xs text-blue-700">
                      <strong>Rec:</strong> {interaction.recommendation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI Recommendation */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">AI Recommendation:</span>
          <Badge variant="outline">
            {check.recommendation.replace("_", " ")}
          </Badge>
        </div>

        {/* Expandable Reasoning */}
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowReasoning(!showReasoning)}
            className="text-muted-foreground p-0 h-auto"
          >
            {showReasoning ? (
              <ChevronUp className="h-4 w-4 mr-1" />
            ) : (
              <ChevronDown className="h-4 w-4 mr-1" />
            )}
            {showReasoning ? "Hide" : "Show"} AI Reasoning
          </Button>
          {showReasoning && (
            <div className="mt-2 rounded-lg bg-muted/50 p-3">
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {check.reasoning}
              </p>
            </div>
          )}
        </div>

        <Separator />

        {/* Pharmacist Actions */}
        <div>
          <h4 className="font-medium text-sm mb-3">Pharmacist Decision</h4>
          <FeedbackForm
            onSubmit={(data) => onReview(check.id, data)}
            loading={reviewLoading}
            startTime={reviewStartTime}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function calculateAge(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}
