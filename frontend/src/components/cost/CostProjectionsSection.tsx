import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarChart3 } from "lucide-react";
import type { CostProjection } from "@/types";

interface CostProjectionsSectionProps {
  data: CostProjection[];
}

function usd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function CostProjectionsSection({ data }: CostProjectionsSectionProps) {
  const chartData = data.map((d) => ({
    label: `${d.daily_volume}/day`,
    "Without AI": d.monthly_pharmacist_cost_without_ai,
    "With AI": d.monthly_total_cost_with_ai,
    "Net Savings": d.monthly_net_savings,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <BarChart3 className="h-5 w-5" />
          Cost Projections at Scale
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Monthly cost comparison at different daily prescription volumes
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Bar chart */}
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" fontSize={12} />
            <YAxis
              fontSize={12}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              formatter={(value) => [
                usd((value as number) ?? 0),
              ]}
              labelFormatter={(label) => `Volume: ${label}`}
            />
            <Legend />
            <Bar
              dataKey="Without AI"
              fill="#ef4444"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="With AI"
              fill="#22c55e"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>

        {/* Data table */}
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Daily Volume</TableHead>
                <TableHead className="text-xs">Monthly Rx</TableHead>
                <TableHead className="text-xs">AI Cost</TableHead>
                <TableHead className="text-xs">Cost Without AI</TableHead>
                <TableHead className="text-xs">Cost With AI</TableHead>
                <TableHead className="text-xs">Net Savings</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.daily_volume}>
                  <TableCell className="text-xs font-medium">
                    {row.daily_volume}/day
                  </TableCell>
                  <TableCell className="text-xs">
                    {row.monthly_prescriptions.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-xs">{usd(row.monthly_ai_cost)}</TableCell>
                  <TableCell className="text-xs text-red-600">
                    {usd(row.monthly_pharmacist_cost_without_ai)}
                  </TableCell>
                  <TableCell className="text-xs text-green-600">
                    {usd(row.monthly_total_cost_with_ai)}
                  </TableCell>
                  <TableCell className="text-xs font-semibold text-green-700">
                    {usd(row.monthly_net_savings)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
