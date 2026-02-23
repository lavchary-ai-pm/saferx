import { Info } from "lucide-react";

export function DemoBanner() {
  return (
    <div className="flex items-center gap-2 bg-blue-50 border-b border-blue-200 px-4 py-2 text-sm text-blue-800">
      <Info className="h-4 w-4 shrink-0" />
      <p>
        <strong>Demo Mode</strong> - This is a portfolio project using synthetic
        patient data. No real medical data is used. AI analysis is powered by
        Claude Sonnet.
      </p>
    </div>
  );
}
