import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DollarSign, TrendingUp, Clock, UserX, Bot } from "lucide-react";
import type { ROIAnalysis } from "@/types";

interface ROIAnalysisSectionProps {
  data: ROIAnalysis;
}

function usd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function ROIAnalysisSection({ data }: ROIAnalysisSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="h-5 w-5" />
          ROI Analysis
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Comparing fully manual pharmacist review vs. AI-assisted workflow
          across {data.total_prescriptions} prescriptions
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Side-by-side comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Without AI */}
          <div className="rounded-lg border-2 border-red-200 bg-red-50/50 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <UserX className="h-5 w-5 text-red-600" />
              <h4 className="font-semibold text-red-900">Without AI</h4>
            </div>
            <p className="text-xs text-red-700">
              Every prescription requires full pharmacist review
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-red-700">Total prescriptions</span>
                <span className="font-medium">{data.total_prescriptions}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-red-700">Review time each</span>
                <span className="font-medium">{data.avg_review_time_minutes} min</span>
              </div>
              <div className="flex justify-between">
                <span className="text-red-700">Pharmacist rate</span>
                <span className="font-medium">{usd(data.pharmacist_hourly_rate)}/hr</span>
              </div>
              <div className="border-t border-red-200 pt-2 flex justify-between">
                <span className="font-semibold text-red-900">Total Cost</span>
                <span className="font-bold text-red-900 text-lg">
                  {usd(data.cost_without_ai)}
                </span>
              </div>
            </div>
          </div>

          {/* With AI */}
          <div className="rounded-lg border-2 border-green-200 bg-green-50/50 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-green-600" />
              <h4 className="font-semibold text-green-900">With AI</h4>
            </div>
            <p className="text-xs text-green-700">
              AI auto-approves safe prescriptions, pharmacist reviews flagged
              ones
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-green-700">Auto-approved by AI</span>
                <span className="font-medium">
                  {data.auto_approved_count} ({(data.auto_approve_rate * 100).toFixed(1)}%)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-700">Pharmacist reviews</span>
                <span className="font-medium">{data.pharmacist_reviewed_count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-700">Pharmacist cost</span>
                <span className="font-medium">{usd(data.pharmacist_cost_with_ai)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-700">AI cost</span>
                <span className="font-medium">{usd(data.total_ai_cost)}</span>
              </div>
              <div className="border-t border-green-200 pt-2 flex justify-between">
                <span className="font-semibold text-green-900">Total Cost</span>
                <span className="font-bold text-green-900 text-lg">
                  {usd(data.total_cost_with_ai)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Summary metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg border border-green-200 bg-green-50/30 p-3 text-center">
            <DollarSign className="h-5 w-5 text-green-600 mx-auto mb-1" />
            <div className="text-2xl font-bold text-green-700">
              {usd(data.total_savings)}
            </div>
            <p className="text-xs text-muted-foreground">Net Savings</p>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50/30 p-3 text-center">
            <TrendingUp className="h-5 w-5 text-green-600 mx-auto mb-1" />
            <div className="text-2xl font-bold text-green-700">
              {data.roi_percentage.toLocaleString()}%
            </div>
            <p className="text-xs text-muted-foreground">Return on AI Investment</p>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50/30 p-3 text-center">
            <Clock className="h-5 w-5 text-blue-600 mx-auto mb-1" />
            <div className="text-2xl font-bold text-blue-700">
              {data.pharmacist_hours_saved}h
            </div>
            <p className="text-xs text-muted-foreground">
              Pharmacist Hours Saved
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
