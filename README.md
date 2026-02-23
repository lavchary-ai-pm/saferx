# SafeRx - AI Medication Interaction Review

An AI-powered pharmacy medication interaction checker that routes decisions through a pharmacist review workflow. Built to demonstrate Responsible AI, Human-in-the-Loop decision-making, AI Safety, and Confidence Threshold Analysis in a healthcare context.

## What This Demonstrates

| Skill Area | How SafeRx Shows It |
|---|---|
| **Responsible AI / Data Governance** | PHI masking strips patient identity before AI processing. Side-by-side visualization shows exactly what the AI sees vs. the raw data. Every masking event is audit-logged. |
| **Human-in-the-Loop** | AI never auto-approves risky prescriptions. Pharmacists review AI recommendations, agree/disagree, and provide feedback - all tracked. |
| **AI Safety / Consequence Design** | Confidence-based routing with three independent safety gates. Only low-risk, high-confidence prescriptions with an AI "auto_approve" recommendation skip human review. |
| **Feedback Loops / MLOps** | Pharmacist agreement rates, override patterns, and decision times feed back into the audit log. This data would drive model retraining in production. |
| **Confidence Threshold Analysis** | Interactive simulator with 300 historical records. Drag a slider to see how threshold changes affect false negatives, pharmacist workload, and patient safety. |

## Architecture

```
                                    SafeRx Architecture

  Browser (React + TypeScript)                    FastAPI Backend (Python)
  ========================                        =======================

  SubmitPage                                      POST /api/prescriptions
    PrescriptionForm  ------>  Submit Rx  -------->  Save to SQLite
    MaskingView       <------  Masking   <--------  mask_patient_data()
                                                       |
                                                       v
                               AI Check  -------->  interaction_checker.py
                                                       |  Claude Sonnet API
                                                       |  (masked data only)
                                                       v
                               Routing   -------->  router.py
                                                    confidence >= 95%
                                                    AND risk == "low"
                                                    AND AI says auto_approve
                                                       |
                                          +------------+------------+
                                          |                         |
                                     Auto-Approve           Route to Queue
                                          |                         |
                                          v                         v
  ReviewPage                                      GET /api/queue
    ReviewQueue       <------  Queue     <--------  Pending reviews
    ReviewCard        <------  Details   <--------  AI analysis + patient
    FeedbackForm      ------>  Decision  -------->  POST /api/reviews/{id}
                                                       |
                                                       v
  AuditPage                                       GET /api/audit
    AuditLog          <------  History   <--------  Every decision logged

  AnalyticsPage                                   GET /api/analytics/*
    AnalyticsDashboard <-----  Metrics   <--------  Aggregate stats
    ThresholdSimulator <-----  Simulate  <--------  300 historical records
```

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React 19, TypeScript, Vite |
| UI | Tailwind CSS v4, Shadcn UI, Recharts, Lucide icons |
| Backend | Python, FastAPI |
| AI | Claude Sonnet via Anthropic Python SDK |
| Database | SQLite (local), Supabase migration scripts included |
| Deployment | Vercel (frontend) + Render (backend) |

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.10+
- An Anthropic API key ([get one here](https://console.anthropic.com/))

### Setup

```bash
# Clone the repo
git clone https://github.com/yourusername/saferx.git
cd saferx

# Backend setup
cd backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
python seed.py          # Seed database with 10 synthetic patients + 28 medications
cd ..

# Frontend setup
cd frontend
npm install
cd ..
```

### Running Locally

```bash
# Terminal 1: Start the backend
cd backend
uvicorn api:app --reload --port 8000

# Terminal 2: Start the frontend
cd frontend
npm run dev
```

Open http://localhost:5173 in your browser.

### Quick Demo Flow

1. **Submit** - Go to Submit Prescription, select "Margaret Chen", prescribe "Ibuprofen 200mg". Watch the PHI masking visualization, then see Claude flag a critical Warfarin + NSAID interaction.
2. **Review** - Navigate to Pharmacist Review. See the AI analysis with risk level, confidence score, interactions found, and reasoning. Approve, reject, or escalate.
3. **Audit** - Check the Audit Log to see every decision recorded with timestamps, AI vs. pharmacist agreement, and review times.
4. **Analyze** - Open Analytics to see system metrics and drag the threshold slider to explore the safety vs. efficiency tradeoff.

## Key Features

### PHI Masking

Patient data is stripped before it reaches the AI. The masking module:
- Replaces names with tokens (e.g., `PATIENT_0042`)
- Converts exact DOB to age ranges (e.g., `60-69`)
- Converts exact weight to ranges (e.g., `80-90kg`)
- Categorizes allergies instead of listing specific ones
- Preserves medication names, dosages, and frequencies (AI needs these)
- Logs every mask/demask event for compliance auditing

### Confidence-Based Routing

Three independent safety gates must ALL pass for auto-approval:

```
1. AI confidence >= 95%
2. Risk level == "low"
3. AI recommendation == "auto_approve"
```

If any gate fails, the prescription goes to the pharmacist queue. This "defense in depth" approach means the system errs on the side of human review.

### Drug Interaction Knowledge Base

30 interaction rules using real generic drug names from public FDA data:
- **5 Critical**: Warfarin+NSAIDs, SSRIs+MAOIs, Simvastatin+Clarithromycin, ACE Inhibitors+Potassium, Methotrexate+NSAIDs
- **8 Severe**: Digoxin+Verapamil, Sildenafil+Nitrates, Lithium+Thiazides, and more
- **10 Moderate**: Lisinopril+NSAIDs, Fluoxetine+Tramadol, Statins+Gemfibrozil, and more
- **7 Minor**: Acetaminophen+Warfarin, Levothyroxine+Calcium, and more

### Threshold Simulator

Uses 300 pre-generated historical records with ground truth labels. The simulator sweeps confidence thresholds from 80% to 99% and shows:
- How many prescriptions would be auto-approved at each threshold
- Estimated false negatives (dangerous prescriptions that slip through)
- Pharmacist hours/day required
- The fundamental tradeoff: lower threshold = less pharmacist work but more risk

## Project Structure

```
saferx/
├── backend/
│   ├── api.py                          # FastAPI app with all endpoints
│   ├── src/
│   │   ├── models.py                   # Pydantic models
│   │   ├── database.py                 # SQLite schema + connection
│   │   ├── masking.py                  # PHI masking/de-masking
│   │   ├── interaction_checker.py      # Claude API integration
│   │   ├── router.py                   # Confidence-based routing
│   │   ├── audit.py                    # Audit log read/write
│   │   └── feedback.py                 # Pharmacist feedback storage
│   ├── data/
│   │   ├── patients.json               # 10 synthetic patient profiles
│   │   ├── interactions.json           # 30 drug interaction rules
│   │   └── historical_records.json     # 300 records for simulator
│   ├── seed.py                         # Database seeding script
│   ├── requirements.txt
│   └── supabase/
│       └── migrations/
│           └── 001_initial_schema.sql  # Supabase migration
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/                 # AppShell, Sidebar, DemoBanner
│   │   │   ├── prescription/           # PrescriptionForm, PatientSelector
│   │   │   ├── masking/                # MaskingView (before/after)
│   │   │   ├── review/                 # ReviewQueue, ReviewCard, FeedbackForm
│   │   │   ├── audit/                  # AuditLog (filterable table)
│   │   │   └── analytics/              # AnalyticsDashboard, ThresholdSimulator
│   │   ├── pages/                      # SubmitPage, ReviewPage, AuditPage, AnalyticsPage
│   │   ├── lib/api.ts                  # API client functions
│   │   └── types/index.ts             # Shared TypeScript types
│   └── package.json
├── .gitignore
├── .env.example
└── README.md
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/patients` | List patients with medication counts |
| GET | `/api/patients/{id}` | Patient details + current medications |
| POST | `/api/prescriptions` | Submit a new prescription |
| GET | `/api/prescriptions/{id}/masking` | Before/after masking comparison |
| POST | `/api/prescriptions/{id}/check` | Run AI interaction check pipeline |
| GET | `/api/queue` | Pharmacist review queue |
| POST | `/api/reviews/{check_id}` | Submit pharmacist decision + feedback |
| GET | `/api/audit` | Filterable audit log |
| GET | `/api/audit/export` | Export audit log as CSV |
| GET | `/api/analytics/summary` | Aggregate system metrics |
| GET | `/api/analytics/threshold-simulation` | Threshold simulation data |

## Synthetic Data

**10 Patient Profiles** designed for different demo scenarios:
- Margaret Chen (67, on Warfarin) - demonstrates critical drug interactions
- Kyle Mitchell (28, healthy) - demonstrates auto-approve path
- Harold Foster (78, polypharmacy with 5 meds) - demonstrates complex review
- And 7 more covering diabetes, mental health, pain management, and minimal medication profiles

**300 Historical Records** with realistic distribution:
- 130 low risk, 80 medium, 60 high, 30 critical
- 31.3% marked as ground-truth dangerous
- 15% were auto-approved under the current 95% threshold

## Deployment

### Frontend (Vercel)

```bash
cd frontend
npm run build    # Output in dist/
# Deploy dist/ to Vercel, set VITE_API_URL to your backend URL
```

### Backend (Render)

```bash
# Set environment variables:
# - ANTHROPIC_API_KEY
# - FRONTEND_URL (your Vercel URL)
# - DATABASE_PATH (default: ./saferx.db)
#
# Start command: uvicorn api:app --host 0.0.0.0 --port $PORT
```

### Supabase Migration

For production, replace SQLite with Supabase PostgreSQL:

```bash
# Apply the migration script
psql $DATABASE_URL < backend/supabase/migrations/001_initial_schema.sql
```

## License

MIT
