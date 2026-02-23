import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RiskBadge } from "@/components/review/RiskBadge";
import { Download, ChevronLeft, ChevronRight } from "lucide-react";
import { getAuditLog, getAuditExportUrl } from "@/lib/api";
import type { AuditEntry } from "@/types";

const PAGE_SIZE = 20;

function formatLabel(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function AuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    setLoading(true);
    setError(null);
    getAuditLog({
      risk_level: riskFilter === "all" ? undefined : riskFilter,
      status: statusFilter === "all" ? undefined : statusFilter,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    })
      .then((data) => {
        setEntries(data.entries);
        setTotal(data.total);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load audit log"))
      .finally(() => setLoading(false));
  }, [page, riskFilter, statusFilter]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [riskFilter, statusFilter]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Filters + Export */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Select value={riskFilter} onValueChange={setRiskFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Risk Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Risk Levels</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="escalated">Escalated</SelectItem>
              <SelectItem value="in_review">In Review</SelectItem>
            </SelectContent>
          </Select>

          <span className="text-sm text-muted-foreground">
            {total} {total === 1 ? "entry" : "entries"}
          </span>
        </div>

        <Button variant="outline" size="sm" asChild>
          <a href={getAuditExportUrl()} download>
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </a>
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Patient ID</TableHead>
              <TableHead>Medication</TableHead>
              <TableHead>AI Risk</TableHead>
              <TableHead>AI Confidence</TableHead>
              <TableHead>AI Rec</TableHead>
              <TableHead>Pharmacist Decision</TableHead>
              <TableHead>AI Alignment</TableHead>
              <TableHead>Review Time</TableHead>
              <TableHead>Final Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  No audit entries found.
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-xs whitespace-nowrap">
                    {new Date(entry.timestamp).toLocaleString()}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {entry.patient_id_masked}
                  </TableCell>
                  <TableCell className="text-xs">
                    {entry.medication_name}
                  </TableCell>
                  <TableCell>
                    {entry.ai_risk_level && (
                      <RiskBadge level={entry.ai_risk_level} size="sm" />
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {entry.ai_confidence != null
                      ? `${Math.round(entry.ai_confidence * 100)}%`
                      : "-"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {formatLabel(entry.ai_recommendation) || "-"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {entry.pharmacist_decision ? (
                      formatLabel(entry.pharmacist_decision)
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <AgreementBadge value={entry.ai_pharmacist_agreement} />
                  </TableCell>
                  <TableCell className="text-xs">
                    {entry.time_to_decision_seconds != null
                      ? `${entry.time_to_decision_seconds}s`
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={entry.final_status} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function AgreementBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-muted-foreground">-</span>;
  if (value === 1) {
    return (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300 text-xs">
        Aligned
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300 text-xs">
      Overridden
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, string> = {
    approved: "bg-green-50 text-green-700 border-green-300",
    rejected: "bg-red-50 text-red-700 border-red-300",
    escalated: "bg-orange-50 text-orange-700 border-orange-300",
    in_review: "bg-blue-50 text-blue-700 border-blue-300",
    pending: "bg-gray-50 text-gray-700 border-gray-300",
  };

  return (
    <Badge
      variant="outline"
      className={`text-xs ${config[status] || config.pending}`}
    >
      {formatLabel(status)}
    </Badge>
  );
}
