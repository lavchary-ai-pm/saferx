import { NavLink } from "react-router-dom";
import {
  FileText,
  Shield,
  ClipboardList,
  BarChart3,
  PlusCircle,
  DollarSign,
} from "lucide-react";

const navItems = [
  { to: "/", label: "Submit Prescription", icon: PlusCircle },
  { to: "/review", label: "Pharmacist Review", icon: Shield },
  { to: "/audit", label: "Audit Log", icon: ClipboardList },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/cost-roi", label: "AI Cost & ROI", icon: DollarSign },
];

export function Sidebar() {
  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-card">
      <div className="flex items-center gap-2 border-b px-6 py-4">
        <FileText className="h-6 w-6 text-blue-600" />
        <div>
          <h1 className="text-lg font-bold">SafeRx</h1>
          <p className="text-xs text-muted-foreground">
            AI Medication Review
          </p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`
                }
                end={item.to === "/"}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t px-6 py-3">
        <p className="text-xs text-muted-foreground">
          Portfolio Project by Lavanya Chary
        </p>
      </div>
    </aside>
  );
}
