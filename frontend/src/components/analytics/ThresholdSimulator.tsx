import { useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { SlidersHorizontal, AlertTriangle, Users, Zap } from "lucide-react";
import type { ThresholdSimulationResponse } from "@/types";

interface ThresholdSimulatorProps {
  data: ThresholdSimulationResponse;
}

export function ThresholdSimulator({ data }: ThresholdSimulatorProps) {
  const [threshold, setThreshold] = useState(
    Math.round(data.current_threshold * 100)
  );

  // Find the simulation result matching current slider position
  const currentSim = useMemo(() => {
    return data.simulations.find(
      (s) => Math.round(s.threshold * 100) === threshold
    );
  }, [data.simulations, threshold]);

  // Prepare chart data - format percentages for x-axis
  const chartData = useMemo(() => {
    return data.simulations.map((s) => ({
      ...s,
      threshold_pct: Math.round(s.threshold * 100),
      false_negative_pct: (s.false_negative_rate * 100).toFixed(2),
    }));
  }, [data.simulations]);

  const totalRecords = data.simulations[0]
    ? data.simulations[0].auto_approved_count +
      data.simulations[0].routed_to_pharmacist_count
    : 300;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SlidersHorizontal className="h-5 w-5" />
          Confidence Threshold Simulator
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Drag the slider to see how changing the auto-approve confidence
          threshold affects safety and pharmacist workload. Based on{" "}
          {totalRecords} historical records.
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Slider control */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">
              Auto-Approve Threshold
            </label>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{threshold}%</span>
              {threshold === Math.round(data.current_threshold * 100) && (
                <Badge variant="secondary" className="text-xs">
                  Current
                </Badge>
              )}
            </div>
          </div>
          <Slider
            value={[threshold]}
            onValueChange={(vals) => setThreshold(vals[0])}
            min={80}
            max={99}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>80% (More auto-approve)</span>
            <span>99% (More pharmacist review)</span>
          </div>
        </div>

        {/* Impact metrics at current threshold */}
        {currentSim && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ImpactCard
              icon={<Zap className="h-4 w-4 text-green-600" />}
              label="Auto-Approved"
              value={currentSim.auto_approved_count}
              detail={`${((currentSim.auto_approved_count / totalRecords) * 100).toFixed(1)}% of total`}
              explanation="Prescriptions that skip pharmacist review at this threshold"
            />
            <ImpactCard
              icon={<Users className="h-4 w-4 text-blue-600" />}
              label="Pharmacist Queue"
              value={currentSim.routed_to_pharmacist_count}
              detail={`${currentSim.pharmacist_hours_per_day} hrs/day`}
              explanation="Prescriptions routed to a pharmacist for manual review"
            />
            <ImpactCard
              icon={<AlertTriangle className="h-4 w-4 text-red-600" />}
              label="False Negatives"
              value={currentSim.estimated_false_negatives}
              detail={`${(currentSim.false_negative_rate * 100).toFixed(2)}% miss rate`}
              danger={currentSim.estimated_false_negatives > 0}
              explanation="Dangerous prescriptions auto-approved without human review"
            />
            <ImpactCard
              icon={<Users className="h-4 w-4 text-purple-600" />}
              label="Pharmacist Hours/Day"
              value={`${currentSim.pharmacist_hours_per_day}`}
              detail="At 5 min per review"
              explanation="Estimated daily pharmacist workload for queued reviews"
            />
          </div>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Auto-approve vs Pharmacist queue */}
          <div>
            <h4 className="text-sm font-medium mb-3">
              Workload Distribution by Threshold
            </h4>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="threshold_pct"
                  tickFormatter={(v) => `${v}%`}
                  fontSize={12}
                />
                <YAxis fontSize={12} />
                <Tooltip
                  formatter={(value, name) => [
                    value ?? 0,
                    name === "auto_approved_count"
                      ? "Auto-Approved"
                      : "Pharmacist Queue",
                  ]}
                  labelFormatter={(label) => `Threshold: ${label}%`}
                />
                <Legend
                  formatter={(value) =>
                    value === "auto_approved_count"
                      ? "Auto-Approved"
                      : "Pharmacist Queue"
                  }
                />
                <Bar
                  dataKey="auto_approved_count"
                  fill="#22c55e"
                  stackId="a"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="routed_to_pharmacist_count"
                  fill="#3b82f6"
                  stackId="a"
                  radius={[4, 4, 0, 0]}
                />
                <ReferenceLine
                  x={Math.round(data.current_threshold * 100)}
                  stroke="#f97316"
                  strokeDasharray="5 5"
                  label={{
                    value: "Current",
                    position: "top",
                    fill: "#f97316",
                    fontSize: 11,
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* False negative rate */}
          <div>
            <h4 className="text-sm font-medium mb-3">
              Safety Risk: False Negative Rate
            </h4>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="threshold_pct"
                  tickFormatter={(v) => `${v}%`}
                  fontSize={12}
                />
                <YAxis
                  tickFormatter={(v) => `${v}%`}
                  fontSize={12}
                  domain={[0, "auto"]}
                />
                <Tooltip
                  formatter={(value) => [
                    `${value ?? 0}%`,
                    "False Negative Rate",
                  ]}
                  labelFormatter={(label) => `Threshold: ${label}%`}
                />
                <Line
                  type="monotone"
                  dataKey="false_negative_pct"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <ReferenceLine
                  x={Math.round(data.current_threshold * 100)}
                  stroke="#f97316"
                  strokeDasharray="5 5"
                  label={{
                    value: "Current",
                    position: "top",
                    fill: "#f97316",
                    fontSize: 11,
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Insight callout */}
        <div className="rounded-lg bg-muted/50 border p-4">
          <h4 className="text-sm font-medium mb-1">Key Insight</h4>
          <p className="text-sm text-muted-foreground">
            Lowering the threshold from 95% to 80% would auto-approve{" "}
            <strong>
              {(data.simulations.find((s) => Math.round(s.threshold * 100) === 80)
                ?.auto_approved_count || 0) -
                (data.simulations.find(
                  (s) =>
                    Math.round(s.threshold * 100) ===
                    Math.round(data.current_threshold * 100)
                )?.auto_approved_count || 0)}{" "}
              more prescriptions
            </strong>
            , but would also miss{" "}
            <strong>
              {(data.simulations.find((s) => Math.round(s.threshold * 100) === 80)
                ?.estimated_false_negatives || 0) -
                (data.simulations.find(
                  (s) =>
                    Math.round(s.threshold * 100) ===
                    Math.round(data.current_threshold * 100)
                )?.estimated_false_negatives || 0)}{" "}
              additional dangerous interactions
            </strong>
            . In a healthcare context, this tradeoff directly impacts patient safety.
          </p>
        </div>

        {/* Simulated data explanation */}
        <p className="text-xs text-muted-foreground text-center">
          This simulation runs against {totalRecords} pre-generated historical
          records with ground-truth labels, not live prescription data. It models
          what would happen at scale under different confidence thresholds.
        </p>
      </CardContent>
    </Card>
  );
}

function ImpactCard({
  icon,
  label,
  value,
  detail,
  danger,
  explanation,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  detail: string;
  danger?: boolean;
  explanation?: string;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${danger ? "border-red-200 bg-red-50" : ""}`}
    >
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className={`text-xl font-bold ${danger ? "text-red-700" : ""}`}>
        {value}
      </div>
      <p className="text-xs text-muted-foreground">{detail}</p>
      {explanation && (
        <p className="text-[10px] text-muted-foreground/70 mt-1 leading-tight">
          {explanation}
        </p>
      )}
    </div>
  );
}
