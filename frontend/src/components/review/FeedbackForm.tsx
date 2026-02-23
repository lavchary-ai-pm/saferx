import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ThumbsUp, ThumbsDown } from "lucide-react";

interface FeedbackFormProps {
  onSubmit: (data: {
    decision: "approved" | "rejected" | "escalated";
    agrees_with_ai: boolean | null;
    feedback_text: string | null;
    time_to_decision_seconds: number | null;
  }) => void;
  loading?: boolean;
  startTime: number;
}

export function FeedbackForm({ onSubmit, loading, startTime }: FeedbackFormProps) {
  const [agreesWithAi, setAgreesWithAi] = useState<boolean | null>(null);
  const [feedbackText, setFeedbackText] = useState("");

  function handleDecision(decision: "approved" | "rejected" | "escalated") {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    onSubmit({
      decision,
      agrees_with_ai: agreesWithAi,
      feedback_text: feedbackText.trim() || null,
      time_to_decision_seconds: elapsed,
    });
  }

  return (
    <div className="space-y-4">
      {/* Agreement feedback */}
      <div className="space-y-2">
        <Label>Do you agree with the AI's recommendation?</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={agreesWithAi === true ? "default" : "outline"}
            size="sm"
            onClick={() => setAgreesWithAi(true)}
            className={agreesWithAi === true ? "bg-green-600 hover:bg-green-700" : ""}
          >
            <ThumbsUp className="h-4 w-4 mr-1" />
            Agree
          </Button>
          <Button
            type="button"
            variant={agreesWithAi === false ? "default" : "outline"}
            size="sm"
            onClick={() => setAgreesWithAi(false)}
            className={agreesWithAi === false ? "bg-red-600 hover:bg-red-700" : ""}
          >
            <ThumbsDown className="h-4 w-4 mr-1" />
            Disagree
          </Button>
        </div>
      </div>

      {/* Free text feedback */}
      <div className="space-y-2">
        <Label htmlFor="feedback">Feedback (optional)</Label>
        <Textarea
          id="feedback"
          placeholder="Add notes about your decision..."
          value={feedbackText}
          onChange={(e) => setFeedbackText(e.target.value)}
          rows={2}
        />
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 pt-2">
        <Button
          onClick={() => handleDecision("approved")}
          disabled={loading}
          className="bg-green-600 hover:bg-green-700"
        >
          Approve
        </Button>
        <Button
          onClick={() => handleDecision("rejected")}
          disabled={loading}
          variant="destructive"
        >
          Reject
        </Button>
        <Button
          onClick={() => handleDecision("escalated")}
          disabled={loading}
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          Escalate
        </Button>
      </div>
    </div>
  );
}
