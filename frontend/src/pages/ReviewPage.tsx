import { useEffect, useState, useCallback } from "react";
import { ReviewQueue } from "@/components/review/ReviewQueue";
import { ReviewCard } from "@/components/review/ReviewCard";
import { getReviewQueue, submitReview } from "@/lib/api";
import { Loader2, Shield } from "lucide-react";
import type { QueueItem } from "@/types";

export function ReviewPage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    try {
      const data = await getReviewQueue();
      setQueue(data.items);
      // Auto-select first item if nothing selected
      if (data.items.length > 0 && !selectedId) {
        setSelectedId(data.items[0].interaction_check.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load queue");
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const selectedItem = queue.find(
    (item) => item.interaction_check.id === selectedId
  );

  async function handleReview(
    checkId: string,
    data: {
      decision: "approved" | "rejected" | "escalated";
      agrees_with_ai: boolean | null;
      feedback_text: string | null;
      time_to_decision_seconds: number | null;
    }
  ) {
    setReviewLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await submitReview(checkId, data);
      setSuccessMessage(
        `Prescription ${data.decision}. Decision recorded.`
      );

      // Remove from queue and select next item
      const remaining = queue.filter(
        (item) => item.interaction_check.id !== checkId
      );
      setQueue(remaining);
      if (remaining.length > 0) {
        setSelectedId(remaining[0].interaction_check.id);
      } else {
        setSelectedId(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit review");
    } finally {
      setReviewLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6" />
          Pharmacist Review Queue
        </h2>
        <p className="text-muted-foreground mt-1">
          Review AI recommendations and make final decisions on flagged
          prescriptions
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800">
          {successMessage}
        </div>
      )}

      <div className="grid grid-cols-[300px_1fr] gap-6">
        {/* Queue sidebar */}
        <div>
          <ReviewQueue
            items={queue}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>

        {/* Selected review */}
        <div>
          {selectedItem ? (
            <ReviewCard
              item={selectedItem}
              onReview={handleReview}
              reviewLoading={reviewLoading}
            />
          ) : (
            <div className="rounded-lg border border-dashed p-12 text-center">
              <p className="text-muted-foreground">
                {queue.length === 0
                  ? "No prescriptions pending review"
                  : "Select a prescription from the queue to review"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
