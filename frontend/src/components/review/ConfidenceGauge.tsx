interface ConfidenceGaugeProps {
  score: number;
  size?: "sm" | "md" | "lg";
}

function getColor(score: number): string {
  if (score >= 0.9) return "text-green-600";
  if (score >= 0.7) return "text-yellow-600";
  return "text-red-600";
}

function getBgColor(score: number): string {
  if (score >= 0.9) return "bg-green-500";
  if (score >= 0.7) return "bg-yellow-500";
  return "bg-red-500";
}

function getTrackColor(score: number): string {
  if (score >= 0.9) return "bg-green-100";
  if (score >= 0.7) return "bg-yellow-100";
  return "bg-red-100";
}

export function ConfidenceGauge({ score, size = "md" }: ConfidenceGaugeProps) {
  const percentage = Math.round(score * 100);

  const sizeClasses = {
    sm: { text: "text-lg", bar: "h-1.5", container: "" },
    md: { text: "text-2xl", bar: "h-2", container: "min-w-[120px]" },
    lg: { text: "text-3xl", bar: "h-3", container: "min-w-[160px]" },
  };

  const s = sizeClasses[size];

  return (
    <div className={`flex flex-col items-center gap-1 ${s.container}`}>
      <span className={`${s.text} font-bold tabular-nums ${getColor(score)}`}>
        {percentage}%
      </span>
      <div className={`w-full rounded-full ${getTrackColor(score)} ${s.bar}`}>
        <div
          className={`${s.bar} rounded-full transition-all duration-500 ${getBgColor(score)}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground">Confidence</span>
    </div>
  );
}
