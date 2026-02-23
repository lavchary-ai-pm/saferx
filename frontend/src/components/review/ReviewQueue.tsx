import { Badge } from "@/components/ui/badge";
import { RiskBadge } from "./RiskBadge";
import { Clock } from "lucide-react";
import type { QueueItem } from "@/types";

interface ReviewQueueProps {
  items: QueueItem[];
  selectedId: string | null;
  onSelect: (checkId: string) => void;
}

export function ReviewQueue({ items, selectedId, onSelect }: ReviewQueueProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-muted-foreground">No prescriptions pending review.</p>
        <p className="text-sm text-muted-foreground mt-1">
          Submit a prescription to see it appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="font-medium text-sm">Pending Reviews</h3>
        <Badge variant="secondary">{items.length}</Badge>
      </div>
      {items.map((item) => {
        const isSelected = item.interaction_check.id === selectedId;
        return (
          <button
            key={item.interaction_check.id}
            onClick={() => onSelect(item.interaction_check.id)}
            className={`w-full text-left rounded-lg border p-3 transition-colors ${
              isSelected
                ? "border-primary bg-primary/5"
                : "hover:bg-muted/50"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium text-sm">
                  {item.prescription.medication_name}{" "}
                  {item.prescription.dosage}
                </span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {item.patient.name}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <RiskBadge level={item.interaction_check.risk_level} size="sm" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {new Date(item.interaction_check.created_at).toLocaleString()}
            </div>
          </button>
        );
      })}
    </div>
  );
}
