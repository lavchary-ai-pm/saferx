import { useEffect, useState } from "react";
import { CostBreakdownSection } from "@/components/cost/CostBreakdownSection";
import { ROIAnalysisSection } from "@/components/cost/ROIAnalysisSection";
import { CostProjectionsSection } from "@/components/cost/CostProjectionsSection";
import { getCostROI } from "@/lib/api";
import { Loader2, DollarSign } from "lucide-react";
import type { CostROIResponse } from "@/types";

export function CostROIPage() {
  const [data, setData] = useState<CostROIResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const response = await getCostROI();
        setData(response);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load cost & ROI data"
        );
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-800">
        {error}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <DollarSign className="h-6 w-6" />
          AI Cost & ROI
        </h2>
        <p className="text-muted-foreground mt-1">
          AI cost analysis and return on investment from automated prescription
          screening
        </p>
      </div>

      <CostBreakdownSection data={data.cost_breakdown} />
      <ROIAnalysisSection data={data.roi_analysis} />
      <CostProjectionsSection data={data.projections} />

      <p className="text-xs text-muted-foreground text-center">
        Based on {data.data_sources.live_prescription_count} live prescriptions
        and {data.data_sources.historical_record_count} historical records.
        Token estimates are approximate. Pharmacist rate based on US average
        ($65/hr).
      </p>
    </div>
  );
}
