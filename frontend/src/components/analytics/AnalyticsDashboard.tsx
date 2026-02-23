import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Brain,
  BarChart3,
} from "lucide-react";
import type { AnalyticsSummary } from "@/types";

interface AnalyticsDashboardProps {
  data: AnalyticsSummary;
}

export function AnalyticsDashboard({ data }: AnalyticsDashboardProps) {
  const metrics = [
    {
      title: "Total Prescriptions",
      value: data.total_prescriptions.toLocaleString(),
      subtitle: `${data.auto_approved_count} auto-approved, ${data.pharmacist_reviewed_count} reviewed`,
      icon: Activity,
      color: "text-blue-600",
    },
    {
      title: "Auto-Approve Rate",
      value: `${(data.auto_approve_rate * 100).toFixed(1)}%`,
      subtitle: `${data.auto_approved_count} of ${data.total_prescriptions} prescriptions`,
      icon: CheckCircle2,
      color: "text-green-600",
    },
    {
      title: "Override Rate",
      value: `${(data.override_rate * 100).toFixed(1)}%`,
      subtitle: "Pharmacist disagreed with AI",
      icon: AlertTriangle,
      color: data.override_rate > 0.2 ? "text-red-600" : "text-orange-600",
    },
    {
      title: "Avg AI Confidence",
      value: `${(data.average_confidence * 100).toFixed(1)}%`,
      subtitle: "Across all checks",
      icon: Brain,
      color: "text-purple-600",
    },
    {
      title: "Avg Pharmacist Review Time",
      value: data.average_time_to_decision_seconds
        ? `${data.average_time_to_decision_seconds.toFixed(0)}s`
        : "-",
      subtitle: "Pharmacist decision time",
      icon: Clock,
      color: "text-cyan-600",
    },
  ];

  const riskColors: Record<string, string> = {
    low: "bg-green-100 text-green-800",
    medium: "bg-yellow-100 text-yellow-800",
    high: "bg-orange-100 text-orange-800",
    critical: "bg-red-100 text-red-800",
  };

  return (
    <div className="space-y-4">
      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {metrics.map((metric) => (
          <Card key={metric.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {metric.title}
              </CardTitle>
              <metric.icon className={`h-4 w-4 ${metric.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {metric.subtitle}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Risk distribution */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Risk Level Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4 h-32">
            {(["low", "medium", "high", "critical"] as const).map((level) => {
              const count = data.risk_distribution[level] || 0;
              const maxCount = Math.max(...Object.values(data.risk_distribution), 1);
              const heightPct = (count / maxCount) * 100;

              return (
                <div key={level} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-sm font-medium">{count}</span>
                  <div className="w-full relative" style={{ height: "80px" }}>
                    <div
                      className={`absolute bottom-0 w-full rounded-t ${riskColors[level].split(" ")[0]}`}
                      style={{ height: `${Math.max(heightPct, 4)}%` }}
                    />
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${riskColors[level]}`}>
                    {level}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
