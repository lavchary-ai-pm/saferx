import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getPatients } from "@/lib/api";
import type { PatientSummary } from "@/types";

interface PatientSelectorProps {
  value: string;
  onChange: (patientId: string) => void;
}

export function PatientSelector({ value, onChange }: PatientSelectorProps) {
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPatients()
      .then(setPatients)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load patients"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-600 p-2 border border-red-200 rounded-md bg-red-50">
        {error}
      </div>
    );
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select a patient..." />
      </SelectTrigger>
      <SelectContent>
        {patients.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            <span className="font-medium">{p.name}</span>
            <span className="ml-2 text-muted-foreground">
              ({p.medication_count} medications)
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
