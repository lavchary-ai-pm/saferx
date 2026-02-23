import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PatientSelector } from "./PatientSelector";
import type { PrescriptionCreate } from "@/types";

interface PrescriptionFormProps {
  onSubmit: (data: PrescriptionCreate) => void;
  loading?: boolean;
}

export function PrescriptionForm({ onSubmit, loading }: PrescriptionFormProps) {
  const [patientId, setPatientId] = useState("");
  const [medicationName, setMedicationName] = useState("");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("");
  const [prescriber, setPrescriber] = useState("");

  const canSubmit =
    patientId && medicationName && dosage && frequency && prescriber && !loading;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      patient_id: patientId,
      medication_name: medicationName,
      dosage,
      frequency,
      prescriber,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New Prescription</CardTitle>
        <CardDescription>
          Submit a prescription to check for drug interactions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="patient">Patient</Label>
            <PatientSelector value={patientId} onChange={setPatientId} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="medication">Medication Name</Label>
            <Input
              id="medication"
              placeholder="e.g., Ibuprofen, Clarithromycin, Omeprazole"
              value={medicationName}
              onChange={(e) => setMedicationName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dosage">Dosage</Label>
              <Input
                id="dosage"
                placeholder="e.g., 400mg"
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="frequency">Frequency</Label>
              <Input
                id="frequency"
                placeholder="e.g., Three times daily"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="prescriber">Prescriber</Label>
            <Input
              id="prescriber"
              placeholder="e.g., Dr. Wilson"
              value={prescriber}
              onChange={(e) => setPrescriber(e.target.value)}
            />
          </div>

          <Button type="submit" disabled={!canSubmit} className="w-full">
            {loading ? "Submitting..." : "Submit Prescription"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
