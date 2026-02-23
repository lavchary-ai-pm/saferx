import { useEffect, useState } from "react";
import { AnalyticsDashboard } from "@/components/analytics/AnalyticsDashboard";
import { ThresholdSimulator } from "@/components/analytics/ThresholdSimulator";
import { getAnalyticsSummary, getThresholdSimulation } from "@/lib/api";
import { Loader2, BarChart3 } from "lucide-react";
import type { AnalyticsSummary, ThresholdSimulationResponse } from "@/types";

export function AnalyticsPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [simulation, setSimulation] = useState<ThresholdSimulationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [summaryData, simData] = await Promise.all([
          getAnalyticsSummary(),
          getThresholdSimulation(),
        ]);
        setSummary(summaryData);
        setSimulation(simData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load analytics");
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6" />
          Analytics Dashboard
        </h2>
        <p className="text-muted-foreground mt-1">
          System performance metrics and confidence threshold analysis
        </p>
      </div>

      {summary && <AnalyticsDashboard data={summary} />}

      {simulation && <ThresholdSimulator data={simulation} />}
    </div>
  );
}
