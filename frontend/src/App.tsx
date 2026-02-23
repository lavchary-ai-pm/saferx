import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { SubmitPage } from "@/pages/SubmitPage";
import { ReviewPage } from "@/pages/ReviewPage";
import { AuditPage } from "@/pages/AuditPage";
import { AnalyticsPage } from "@/pages/AnalyticsPage";
import { CostROIPage } from "@/pages/CostROIPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<SubmitPage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/cost-roi" element={<CostROIPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
