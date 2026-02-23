import { Badge } from "@/components/ui/badge";

const riskConfig: Record<string, { label: string; className: string }> = {
  low: { label: "Low Risk", className: "bg-green-100 text-green-800 border-green-300" },
  minor: { label: "Minor", className: "bg-green-100 text-green-800 border-green-300" },
  medium: { label: "Medium Risk", className: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  moderate: { label: "Moderate", className: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  high: { label: "High Risk", className: "bg-orange-100 text-orange-800 border-orange-300" },
  severe: { label: "Severe", className: "bg-orange-100 text-orange-800 border-orange-300" },
  critical: { label: "Critical", className: "bg-red-100 text-red-800 border-red-300" },
};

interface RiskBadgeProps {
  level: string;
  size?: "sm" | "md";
}

export function RiskBadge({ level, size = "md" }: RiskBadgeProps) {
  const config = riskConfig[level] || riskConfig.medium;
  return (
    <Badge
      variant="outline"
      className={`${config.className} ${size === "sm" ? "text-xs px-1.5 py-0" : "text-sm px-2.5 py-0.5"}`}
    >
      {config.label}
    </Badge>
  );
}
