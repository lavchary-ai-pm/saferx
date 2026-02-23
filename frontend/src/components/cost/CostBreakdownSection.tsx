import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Cpu, Receipt, Database, TrendingUp, Info } from "lucide-react";
import type { CostBreakdown } from "@/types";

interface CostBreakdownSectionProps {
  data: CostBreakdown;
}

function fmt(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

export function CostBreakdownSection({ data }: CostBreakdownSectionProps) {
  const metrics = [
    {
      label: "Cost Per Check",
      value: fmt(data.cost_per_check),
      detail: `${data.avg_input_tokens_per_check.toLocaleString()} in / ${data.avg_output_tokens_per_check.toLocaleString()} out tokens`,
      icon: Cpu,
      color: "text-green-600",
    },
    {
      label: "Total AI Cost (Live)",
      value: fmt(data.total_ai_cost_live),
      detail: `${data.total_checks_live} live checks`,
      icon: Receipt,
      color: "text-blue-600",
    },
    {
      label: "Total AI Cost (Historical)",
      value: fmt(data.total_ai_cost_historical),
      detail: `${data.total_checks_historical} historical records`,
      icon: Database,
      color: "text-purple-600",
    },
    {
      label: "Projected Monthly",
      value: fmt(data.projected_monthly_cost_50_per_day),
      detail: "At 50 prescriptions/day",
      icon: TrendingUp,
      color: "text-orange-600",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Receipt className="h-5 w-5" />
          AI Cost Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {metrics.map((m) => (
            <div key={m.label} className="rounded-lg border p-3">
              <div className="flex items-center gap-2 mb-1">
                <m.icon className={`h-4 w-4 ${m.color}`} />
                <span className="text-xs text-muted-foreground">{m.label}</span>
              </div>
              <div className="text-xl font-bold">{m.value}</div>
              <p className="text-xs text-muted-foreground">{m.detail}</p>
            </div>
          ))}
        </div>

        <div className="flex items-start gap-2 rounded-lg bg-muted/50 border p-3">
          <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p>
              <strong>Model:</strong> {data.model_name}
            </p>
            <p>
              <strong>Pricing:</strong> ${data.input_price_per_million}/M input
              tokens, ${data.output_price_per_million}/M output tokens
            </p>
            <p>
              <strong>Avg tokens per check:</strong>{" "}
              ~{data.avg_input_tokens_per_check.toLocaleString()} input,{" "}
              ~{data.avg_output_tokens_per_check.toLocaleString()} output
              (estimated)
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
