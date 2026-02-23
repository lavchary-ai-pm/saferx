import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, ArrowRight } from "lucide-react";
import type { MaskingComparison } from "@/types";

interface MaskingViewProps {
  data: MaskingComparison;
}

function DataField({
  label,
  rawValue,
  maskedValue,
  isMasked,
}: {
  label: string;
  rawValue: string;
  maskedValue: string;
  isMasked: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-2 border-b last:border-0">
      <span className="w-32 shrink-0 text-sm font-medium text-muted-foreground">
        {label}
      </span>
      <span className="flex-1 text-sm font-mono">{rawValue}</span>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span
        className={`flex-1 text-sm font-mono ${
          isMasked ? "text-green-700 bg-green-50 px-2 py-0.5 rounded" : ""
        }`}
      >
        {maskedValue}
      </span>
      {isMasked && (
        <Badge variant="outline" className="shrink-0 text-green-700 border-green-300">
          Masked
        </Badge>
      )}
      {!isMasked && (
        <Badge variant="outline" className="shrink-0 text-muted-foreground">
          Preserved
        </Badge>
      )}
    </div>
  );
}

export function MaskingView({ data }: MaskingViewProps) {
  const { raw, masked } = data;

  const rawMeds = raw.current_medications
    .map((m) => `${(m as Record<string, string>).medication_name} ${(m as Record<string, string>).dosage}`)
    .join(", ");

  const maskedMeds = masked.current_medications
    .map((m) => `${(m as Record<string, string>).medication_name} ${(m as Record<string, string>).dosage}`)
    .join(", ");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <EyeOff className="h-5 w-5 text-green-600" />
              PHI Masking Layer
            </CardTitle>
            <CardDescription>
              Patient data is masked before being sent to the AI. Medication
              names are preserved because the AI needs them for analysis.
            </CardDescription>
          </div>
        </div>
        <div className="flex items-center gap-4 pt-2 text-sm">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            <span className="font-medium">Raw Data (Pharmacist sees)</span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <div className="flex items-center gap-2">
            <EyeOff className="h-4 w-4 text-green-600" />
            <span className="font-medium text-green-700">
              Masked Data (AI sees)
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        <DataField
          label="Patient Name"
          rawValue={raw.patient_name}
          maskedValue={masked.patient_id}
          isMasked={true}
        />
        <DataField
          label="Date of Birth"
          rawValue={raw.date_of_birth}
          maskedValue={masked.age_range}
          isMasked={true}
        />
        <DataField
          label="Weight"
          rawValue={`${raw.weight_kg} kg`}
          maskedValue={masked.weight_range}
          isMasked={true}
        />
        <DataField
          label="Allergies"
          rawValue={raw.allergies.join(", ") || "None"}
          maskedValue={masked.allergy_categories.join(", ") || "None"}
          isMasked={true}
        />
        <DataField
          label="Medications"
          rawValue={rawMeds}
          maskedValue={maskedMeds}
          isMasked={false}
        />
        <DataField
          label="New Rx"
          rawValue={`${(raw.new_prescription as Record<string, string>).medication_name} ${(raw.new_prescription as Record<string, string>).dosage}`}
          maskedValue={`${(masked.new_prescription as Record<string, string>).medication_name} ${(masked.new_prescription as Record<string, string>).dosage}`}
          isMasked={false}
        />
      </CardContent>
    </Card>
  );
}
