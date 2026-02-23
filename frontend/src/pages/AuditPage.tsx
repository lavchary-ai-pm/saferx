import { AuditLog } from "@/components/audit/AuditLog";
import { ClipboardList } from "lucide-react";

export function AuditPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardList className="h-6 w-6" />
          Audit Log
        </h2>
        <p className="text-muted-foreground mt-1">
          Complete record of every AI recommendation and pharmacist decision
        </p>
      </div>
      <AuditLog />
    </div>
  );
}
