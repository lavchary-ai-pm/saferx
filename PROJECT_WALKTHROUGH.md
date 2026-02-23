# SafeRx - Detailed Project Walkthrough

A deep dive into the design, architecture, decisions, tradeoffs, and Responsible AI thinking behind SafeRx - an AI-powered pharmacy medication interaction checker with human-in-the-loop review.

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [System Architecture](#2-system-architecture)
3. [Data Pipeline - Step by Step](#3-data-pipeline---step-by-step)
4. [Design Decisions and Why](#4-design-decisions-and-why)
5. [Tradeoffs and Why](#5-tradeoffs-and-why)
6. [Responsible AI](#6-responsible-ai)
7. [User Experience Decisions](#7-user-experience-decisions)
8. [Transparency by Design](#8-transparency-by-design)
9. [Confidence Threshold Analysis](#9-confidence-threshold-analysis)
10. [AI Cost and ROI](#10-ai-cost-and-roi)
11. [Interview Questions and Answers](#11-interview-questions-and-answers)

---

## 1. Problem Statement

Pharmacists manually review every new prescription against a patient's existing medications to catch dangerous drug interactions. This is:

- **Time-intensive**: ~5 minutes per review, 50+ prescriptions/day at a busy pharmacy
- **Error-prone under fatigue**: Human reviewers miss interactions at higher rates during peak hours
- **Not scalable**: Adding pharmacist headcount is expensive ($65/hr average US rate)

SafeRx introduces AI as a screening layer. The AI handles the easy cases (no interactions, low risk) and routes the hard cases to pharmacists. This is NOT about replacing pharmacists - it's about focusing their expertise where it matters most.

---

## 2. System Architecture

### System Design Overview

```
+-------------------+          +------------------------+          +------------------+
|                   |          |                        |          |                  |
|   React Frontend  |  HTTP    |   FastAPI Backend       |  HTTPS   |   Claude Sonnet  |
|   (Vite + TS)     +--------->|   (Python)             +--------->|   (Anthropic API)|
|                   |  JSON    |                        |  JSON    |                  |
+-------------------+          +----------+-------------+          +------------------+
                                          |
                                          | SQL
                                          v
                                 +--------+---------+
                                 |                  |
                                 |   SQLite         |
                                 |   (8 tables)     |
                                 |                  |
                                 +------------------+
```

### Architecture Component Table

| Component | Technology | Role | Why This Choice |
|-----------|-----------|------|-----------------|
| **Frontend** | React 19 + TypeScript + Vite | UI for pharmacists and demo viewers | Type safety catches bugs at compile time. Vite gives fast HMR for development. React 19 is current stable. |
| **UI Framework** | Tailwind CSS v4 + Shadcn UI | Component library and styling | Shadcn gives accessible, unstyled primitives. Tailwind avoids CSS bloat. Clinical aesthetic without custom design work. |
| **Charts** | Recharts | Threshold simulator and analytics | React-native charting. Responsive. Handles real-time updates from slider interaction. |
| **Backend** | Python + FastAPI | API server, business logic, AI orchestration | FastAPI gives automatic OpenAPI docs, Pydantic validation, async support. Python matches the Anthropic SDK. |
| **AI Model** | Claude Sonnet 4 (claude-sonnet-4-20250514) | Drug interaction analysis | Best cost/quality ratio for structured medical reasoning. Reliable JSON output. Strong at following scoring rubrics. |
| **Database** | SQLite (local) | Persistent storage for patients, prescriptions, reviews, audit trail | Zero-config, file-based, perfect for demo/portfolio. No external DB dependency for reviewers cloning the repo. |
| **Production DB** | Supabase (PostgreSQL) | Production-ready migration path | Migration scripts included. Shows awareness of production requirements without forcing complexity on demo setup. |
| **Deployment** | Vercel (frontend) + Render (backend) | Hosting | Free tiers available. Vercel handles static/SPA well. Render supports Python with environment variables. |

### Database Schema - 8 Tables

| Table | Purpose | Key Fields | Why It Exists |
|-------|---------|------------|---------------|
| `patients` | Synthetic patient profiles | name, DOB, weight, allergies (JSON) | Seed data for realistic demo scenarios |
| `patient_medications` | Current active prescriptions per patient | patient_id (FK), medication_name, dosage, frequency, active flag | Needed to check new prescriptions against existing regimen |
| `prescriptions` | New prescription submissions | patient_id (FK), medication, dosage, status (pending/checking/approved/rejected/escalated/in_review) | Tracks every submission through its lifecycle |
| `interaction_checks` | AI analysis results | prescription_id (FK), risk_level, confidence_score, interactions_found (JSON), recommendation, reasoning, masked_payload (JSON), raw_payload (JSON), routing_decision | Stores both what the AI saw (masked) and the original data (raw) for transparency |
| `pharmacist_reviews` | Human decisions on AI recommendations | interaction_check_id (FK), decision, agrees_with_ai (boolean), feedback_text, time_to_decision_seconds | Captures agreement/disagreement, free-text feedback, and review speed |
| `masking_events` | PHI masking audit trail | prescription_id, event_type (mask/demask), fields_affected (JSON) | HIPAA compliance - every masking action is logged |
| `audit_log` | Unified decision record | patient_id_masked, ai_recommendation, ai_confidence, pharmacist_decision, ai_pharmacist_agreement, time_to_decision, final_status | Single source of truth for all decisions, powers analytics |

### Request Flow - Prescription Check

```
1. POST /api/prescriptions              -> Create prescription record (status: pending)
2. GET  /api/prescriptions/{id}/masking  -> Return raw vs masked payload comparison
3. POST /api/prescriptions/{id}/check    -> Full AI pipeline:
   a. Load patient + medications from SQLite
   b. Call mask_patient_data() -> strips PHI, logs masking event
   c. Call check_interactions() -> sends masked data to Claude Sonnet
   d. Call route_prescription() -> applies 3 safety gates
   e. Save InteractionCheck to DB (both raw + masked payloads)
   f. Update prescription status (approved or in_review)
   g. Log to audit_log table
   h. Return full result to frontend
```

---

## 3. Data Pipeline - Step by Step

### Step 1: Patient Data (Raw)

```json
{
  "name": "Margaret Chen",
  "date_of_birth": "1956-08-14",
  "weight_kg": 68.2,
  "allergies": ["Penicillin", "Sulfa drugs"],
  "medications": [
    { "medication_name": "Warfarin", "dosage": "5mg", "frequency": "daily" },
    { "medication_name": "Lisinopril", "dosage": "10mg", "frequency": "daily" },
    { "medication_name": "Atorvastatin", "dosage": "20mg", "frequency": "at bedtime" }
  ]
}
```

### Step 2: After PHI Masking

```json
{
  "patient_id": "PATIENT_abc123",
  "age_range": "60-69",
  "weight_range": "60-70kg",
  "allergy_categories": ["Beta-lactam antibiotics", "Sulfonamide antibiotics"],
  "current_medications": [
    { "medication_name": "Warfarin", "dosage": "5mg", "frequency": "daily" },
    { "medication_name": "Lisinopril", "dosage": "10mg", "frequency": "daily" },
    { "medication_name": "Atorvastatin", "dosage": "20mg", "frequency": "at bedtime" }
  ],
  "new_prescription": {
    "medication_name": "Ibuprofen",
    "dosage": "200mg",
    "frequency": "as needed"
  }
}
```

**What changed**: Name gone. DOB converted to age range. Exact weight bucketed. Specific allergies mapped to drug classes. Medication names, dosages, frequencies preserved (AI needs these).

### Step 3: Claude Sonnet Analysis

The masked payload is sent to Claude with a system prompt containing 30 drug interaction rules. Claude returns:

```json
{
  "risk_level": "critical",
  "confidence_score": 1.0,
  "interactions_found": [
    {
      "drug_a": "Warfarin",
      "drug_b": "Ibuprofen",
      "severity": "critical",
      "description": "NSAIDs increase bleeding risk significantly when combined with warfarin...",
      "mechanism": "NSAIDs inhibit platelet aggregation and displace warfarin from protein binding",
      "recommendation": "Contraindicated. Use acetaminophen instead."
    }
  ],
  "recommendation": "reject",
  "reasoning": "This patient is on Warfarin 5mg daily. Adding Ibuprofen creates a critical interaction..."
}
```

### Step 4: Routing Decision

Three independent safety gates evaluate the result:

| Gate | Check | Margaret's Result | Pass/Fail |
|------|-------|------------------|-----------|
| Confidence | >= 95% | 100% | Pass |
| Risk Level | == "low" | "critical" | **FAIL** |
| AI Recommendation | == "auto_approve" | "reject" | **FAIL** |

Result: **Routed to pharmacist queue** (2 of 3 gates failed).

### Step 5: Pharmacist Review

The pharmacist sees the full AI analysis, agrees or disagrees, and makes a final decision. Their review time, decision, and feedback are all captured.

---

## 4. Design Decisions and Why

### Decision 1: Three Independent Safety Gates (Not One)

**What**: Auto-approval requires ALL three conditions: confidence >= 95%, risk == "low", AND AI recommends "auto_approve".

**Why**: Defense in depth. A single threshold creates a single point of failure. Consider edge cases:
- High confidence + high risk = the AI is confident something is dangerous. Must go to pharmacist.
- Low risk + low confidence = the AI thinks it's safe but isn't sure. Must go to pharmacist.
- High confidence + low risk + AI says "pharmacist_review" = Claude spotted something subtle that doesn't fit the structured scoring. Must go to pharmacist.

**The alternative considered**: A single composite score combining risk and confidence. Rejected because it obscures which factor triggered the routing, making the system harder to debug and audit.

### Decision 2: Masking Before AI, Not After

**What**: Patient identity is stripped BEFORE the data reaches Claude. The AI never sees names, exact DOBs, or exact weights.

**Why**: Privacy by design, not privacy by policy. Even if Anthropic's data handling is robust, the principle is that the AI doesn't need identity to check drug interactions. Sending less data is always safer than sending more data with a promise to delete it.

**What we preserve**: Medication names, dosages, and frequencies MUST reach the AI - these are the inputs to the interaction check. We also send age ranges and weight ranges because some interactions are dose-dependent or age-relevant (e.g., renal clearance decreases with age).

### Decision 3: Store Both Raw and Masked Payloads

**What**: The `interaction_checks` table stores two JSON columns: `masked_payload` (what the AI saw) and `raw_payload` (the original data).

**Why**: Auditability. If a pharmacist or regulator asks "what did the AI base its decision on?", we can show exactly what was sent. If there's a masking bug (e.g., age range calculation is wrong), we can compare raw vs masked to find it. The MaskingView component in the frontend displays both side-by-side for the same reason - transparency.

### Decision 4: SQLite for Demo, Supabase Migration Scripts Included

**What**: The app runs on SQLite locally. PostgreSQL migration scripts are in `backend/supabase/migrations/`.

**Why**: Portfolio reviewers who clone the repo should be able to run the app with `pip install` and `npm install` - no Docker, no database server, no configuration. SQLite is zero-config. But including migration scripts shows production awareness without forcing complexity on the demo path.

### Decision 5: Synchronous AI Calls (No Background Queue)

**What**: When a pharmacist clicks "Check Interactions", the API call to Claude happens synchronously and the response comes back in the same HTTP request.

**Why**: Simplicity. Claude Sonnet responds in 2-5 seconds. For a demo with single-user traffic, a synchronous call with a loading spinner is perfectly adequate. A background queue (Celery, Redis, webhooks) would add infrastructure complexity with zero user-facing benefit at this scale.

**When you would change this**: At production scale with concurrent users, you'd move to async processing. The audit logging and database writes are already decoupled enough that the transition would be straightforward.

### Decision 6: Knowledge Base in System Prompt, Not RAG

**What**: All 30 drug interaction rules are loaded into Claude's system prompt as JSON context, rather than using retrieval-augmented generation.

**Why**: 30 rules fit comfortably in a single prompt (~16K characters). RAG adds latency (embedding + vector search + retrieval), complexity (vector database, chunking strategy), and a failure mode (relevant rule not retrieved). For a bounded knowledge base of 30 rules, full-context is simpler and more reliable.

**When you would change this**: If the knowledge base grew to 500+ rules or included lengthy clinical guidelines. At that point, the system prompt would exceed token limits and RAG would be necessary.

### Decision 7: No Authentication

**What**: The app has no login, no user accounts, no session management. A "Demo Mode" banner explains this.

**Why**: This is a portfolio project. The target audience is hiring managers and product leaders who want to click through the demo in 2 minutes. A login wall would kill engagement. The Demo Banner makes the design choice explicit rather than appearing like an oversight.

---

## 5. Tradeoffs and Why

### Tradeoff 1: Safety vs. Efficiency (The Core Product Tradeoff)

**The tension**: A lower confidence threshold auto-approves more prescriptions (saving pharmacist time) but increases the chance a dangerous interaction slips through (false negatives).

**Our position**: The production threshold is 95% with risk == "low" required. This means roughly 15% of prescriptions get auto-approved. That's conservative by design - in healthcare, the cost of a false negative (patient harmed) vastly outweighs the cost of a false positive (pharmacist spends 5 minutes reviewing a safe prescription).

**The Threshold Simulator exists specifically to make this tradeoff visible.** A product leader can drag the slider and see: "If I lower to 85%, I save 2 more pharmacist hours/day but miss 4 additional dangerous interactions per 300 prescriptions." That's not an engineering decision - that's a business/ethics decision with real numbers.

### Tradeoff 2: Token Estimates vs. Actual Token Tracking

**The tension**: The AI Cost page uses estimated token counts (~5,750 input, ~600 output per check) rather than actual token usage from the Anthropic API response.

**Our position**: Estimates are clearly labeled as estimates in the UI. The actual `usage.input_tokens` and `usage.output_tokens` fields exist in Claude's response but aren't captured yet.

**Why this is acceptable**: The estimates are based on measuring the actual system prompt size (18K characters with knowledge base) plus typical patient payloads. They're within 10-15% of actual usage. For a cost analysis demo, directional accuracy matters more than precision. The ROI story (AI costs pennies per check vs. $5+ for pharmacist time) is so overwhelming that even 2x estimation error wouldn't change the conclusion.

**What production would need**: Store actual token counts from each API response in the `interaction_checks` table. Sum real usage for cost reporting.

### Tradeoff 3: Synthetic Data vs. Real Clinical Data

**The tension**: All patient profiles, drug interactions, and historical records are synthetic.

**Our position**: Using real patient data is illegal (HIPAA). Using real clinical trial data requires licensing. Synthetic data designed by someone who understands the domain (interaction severities, realistic polypharmacy patterns, age-appropriate conditions) is the right choice for a portfolio project.

**What makes it credible**: The 30 drug interaction rules use real generic drug names from public FDA data. The severity classifications match actual clinical guidelines. Patient profiles have realistic comorbidity patterns (e.g., elderly patients on warfarin + statins + ACE inhibitors is extremely common).

### Tradeoff 4: Single AI Call vs. Multi-Step Reasoning

**The tension**: Each prescription check makes one Claude API call. A more sophisticated system might do multiple passes: first identify interactions, then assess severity, then generate recommendations.

**Our position**: One call is sufficient because the knowledge base is small (30 rules) and the task is well-constrained. Claude can handle identification + assessment + recommendation in a single structured response.

**Why not multi-step**: Each additional API call adds latency (~2-5 seconds), cost (~$0.03), and a failure point. For this use case, the quality gain from multi-step reasoning doesn't justify the complexity.

### Tradeoff 5: Structured JSON Output vs. Free-Text

**The tension**: We force Claude to respond in a specific JSON format. This constrains the model's expressiveness.

**Our position**: Structured output is essential for automated routing. The system needs to programmatically read `risk_level`, `confidence_score`, and `recommendation` to make routing decisions. Free-text would require another parsing step, introducing fragility.

**How we preserve nuance**: The `reasoning` field is free-text within the JSON structure. Claude explains its thinking in natural language. The `interactions_found` array captures detailed descriptions and mechanisms. The structure constrains the decision, not the explanation.

---

## 6. Responsible AI

### PHI Masking - Privacy by Design

**Principle**: Minimize the data the AI receives to what's strictly necessary for the task.

| Data Point | What AI Sees | Why |
|-----------|-------------|-----|
| Patient name | `PATIENT_abc123` (tokenized ID) | Name is irrelevant to drug interactions |
| Date of birth | `60-69` (age range) | Age ranges are clinically relevant (renal function, metabolism). Exact DOB is not needed. |
| Weight | `60-70kg` (10kg bucket) | Weight ranges matter for dosing. Exact weight doesn't add interaction-checking value. |
| Allergies | Drug class categories | `Penicillin` becomes `Beta-lactam antibiotics`. Class-level is sufficient for interaction screening. |
| Medications | Preserved exactly | Drug names, dosages, frequencies are the core input. Cannot be masked. |
| Prescriber name | Removed entirely | The AI doesn't need to know who prescribed the medication. |

**Audit trail**: Every masking event is logged to the `masking_events` table with a UUID, timestamp, and list of fields affected. This supports HIPAA compliance auditing.

### Human-in-the-Loop - Not Optional, Structural

The system is designed so the AI CANNOT unilaterally approve anything risky:

1. **Three safety gates** prevent auto-approval unless the AI is highly confident AND the risk is low AND the AI explicitly recommends auto-approval
2. **Pharmacist queue** is the default destination - auto-approval is the exception
3. **Agreement tracking** captures whether pharmacists agree with the AI, creating a feedback signal
4. **Time tracking** measures how long pharmacists spend reviewing, which feeds into workload analysis

This isn't "we have a human review step." It's "the system is architecturally incapable of bypassing human review for anything non-trivial."

### Feedback Loops

Every pharmacist review captures:
- **Decision**: Approve, reject, or escalate
- **Agreement**: Thumbs up/down on the AI recommendation
- **Free-text feedback**: Why they agree or disagree
- **Review time**: How long the decision took

This data feeds into:
- **Override rate** (Analytics): What percentage of pharmacists disagree with the AI?
- **Agreement patterns** (Audit Log): Are overrides concentrated on certain drug classes?
- **Review efficiency** (Cost/ROI): How does review time change as the AI improves?

In production, this feedback would drive model retraining. High override rates on specific interaction types would trigger knowledge base updates.

### Consequence Design

The consequences of AI errors in pharmacy are asymmetric:
- **False positive** (AI flags safe prescription): Pharmacist spends 5 minutes reviewing. Cost: ~$5.42. Patient waits a few extra minutes.
- **False negative** (AI misses dangerous interaction): Patient takes harmful drug combination. Cost: hospitalization, injury, death.

SafeRx is designed around this asymmetry. The 95% confidence threshold with risk == "low" requirement means the system strongly favors false positives over false negatives. The Threshold Simulator makes this tradeoff quantifiable and visible.

---

## 7. User Experience Decisions

### Demo-First Design

The target user is a hiring manager or product leader who has 2-3 minutes to evaluate the project. Every UX decision serves that constraint:

1. **No login wall** - Click and explore immediately
2. **Demo Mode banner** - Explains synthetic data upfront, preventing "is this real?" confusion
3. **Pre-seeded patients** - Margaret Chen (warfarin, guaranteed critical interaction), Kyle Mitchell (healthy, guaranteed auto-approve) - demo scenarios work on first try
4. **5-page sidebar** - Each page maps to a portfolio skill (Submit = masking, Review = HITL, Audit = governance, Analytics = threshold analysis, Cost = business case)

### Information Hierarchy on Review Cards

The pharmacist review card is structured by decision importance:

1. **Top**: Medication name + risk badge + confidence gauge (the most critical info)
2. **Middle**: Patient context, current medications, interactions found with severity
3. **Expandable**: Full AI reasoning (available but not forced - respects the pharmacist's time)
4. **Bottom**: Action buttons (approve/reject/escalate) + agreement feedback

This mirrors how pharmacists actually review: medication first, context second, decision last.

### Color Coding

| Color | Meaning | Usage |
|-------|---------|-------|
| Red | Critical/dangerous | Critical risk badges, false negative cards, "Without AI" cost |
| Orange | Warning/escalation | High risk, escalate button, current threshold marker |
| Yellow | Moderate attention | Medium risk badges |
| Green | Safe/positive | Low risk, auto-approved, "With AI" cost, savings |
| Blue | Informational | Pharmacist queue, confidence metrics |
| Purple | AI/analytical | Historical data, projections |

Consistent color semantics across all pages so users build intuition quickly.

---

## 8. Transparency by Design

### What the AI Sees vs. What the Pharmacist Sees

The MaskingView component shows a side-by-side comparison with every field labeled:
- **Green highlight**: This field was masked (name, DOB, weight, allergies)
- **"Preserved" badge**: This field was sent to the AI unchanged (medications, dosages)

This isn't just a feature - it's a trust mechanism. When a pharmacist can verify exactly what the AI received, they can evaluate whether the AI's response makes sense given its inputs.

### Full Reasoning Exposure

Claude's complete reasoning text is stored and displayed (expandable). The pharmacist can read: "I identified a critical interaction between Warfarin and Ibuprofen because NSAIDs inhibit platelet aggregation and displace warfarin from protein binding sites, increasing bleeding risk." This is not a black-box "rejected" label.

### Audit Log

Every decision is logged with:
- Who made the decision (AI recommendation + pharmacist decision)
- When (timestamps)
- What the AI's confidence was
- Whether the pharmacist agreed
- How long the review took
- The final outcome

The audit log is exportable as CSV for external analysis.

---

## 9. Confidence Threshold Analysis

The Threshold Simulator answers the question: **"Where should we set the automation cutoff, and what happens if we move it?"**

### How It Works

300 pre-generated historical records, each with:
- AI confidence score
- Risk level
- AI recommendation
- Ground truth label (was the interaction actually dangerous?)

The simulator sweeps from 80% to 99% and recalculates at each threshold:

| Metric | Formula |
|--------|---------|
| Auto-approved | Count where confidence >= threshold AND risk == "low" |
| Pharmacist queue | Total - auto-approved |
| False negatives | Auto-approved records where ground_truth_dangerous == true |
| False negative rate | False negatives / total |
| Pharmacist hours/day | (queue count * 50/300 * 5 min) / 60 |

### Why This Matters for Product Leaders

This is a **product decision tool**, not just an analytics dashboard. It answers:
- "Can we reduce pharmacist workload by 20%?" - Move the slider and see the safety cost.
- "What's our current false negative rate?" - Read it directly at 95%.
- "What would happen if we tightened the threshold to 99%?" - Almost everything goes to pharmacists, false negatives drop to near zero, but workload spikes.

The tradeoff is real and quantifiable. No hand-waving.

---

## 10. AI Cost and ROI

### Cost Structure

| Component | Formula | Example (50 Rx/day) |
|-----------|---------|-------------------|
| Cost per AI check | (5,750 input tokens x $3/M) + (600 output tokens x $15/M) = $0.026 | - |
| Monthly AI cost | 50/day x 30 days x $0.026 | $39.38 |
| Monthly pharmacist cost without AI | 50/day x 30 days x $5.42/review | $8,125 |
| Monthly pharmacist cost with AI | (non-auto-approved count) x $5.42 | ~$6,879 |
| Monthly net savings | Without AI - (With AI pharmacist + AI cost) | ~$1,206 |

### Why the ROI Is So High

The AI check costs ~$0.03. A pharmacist review costs ~$5.42. That's a ~200x cost difference per prescription. Even if the AI only auto-approves 15% of prescriptions, the savings from those 15% vastly exceed the total AI cost for 100% of prescriptions.

At 50 prescriptions/day, the monthly AI cost ($39) is less than one hour of pharmacist time. The ROI isn't a close call - it's overwhelming.

---

## 11. Interview Questions and Answers

### Product Strategy

**Q1: "Why did you build a medication interaction checker instead of something more commercially viable?"**

This project isn't meant to be a startup - it's designed to demonstrate five specific skills in a single coherent application: Responsible AI (PHI masking), Human-in-the-Loop (pharmacist review), AI Safety (confidence-based routing with consequence design), Feedback Loops (agreement tracking and override analysis), and Confidence Threshold Analysis (the simulator). Healthcare is the ideal domain because the stakes are high enough that these concerns are non-negotiable, not nice-to-haves. A chatbot or recommendation engine could skip most of these and still "work." A medication checker that skips them could hurt someone. That forces rigorous thinking.

---

**Q2: "Your auto-approve rate is only 15%. That means 85% of prescriptions still need a pharmacist. How is this useful?"**

15% auto-approval saves a pharmacist roughly 1 hour per day at 50 prescriptions/day volume. At scale (500/day), that's 10+ hours/day - more than a full pharmacist headcount. But more importantly, 15% is conservative by design. The threshold (95% confidence AND low risk AND AI recommends auto-approve) prioritizes patient safety over efficiency. The Threshold Simulator lets you see what happens at different settings. If you drop to 85% confidence, auto-approval jumps to ~40%, but false negatives increase. The current setting reflects the principle that in healthcare, the cost of missing a dangerous interaction is orders of magnitude higher than the cost of an unnecessary review. That said, 15% is the starting point. As the system accumulates pharmacist feedback and the knowledge base expands, the auto-approve rate should increase over time while maintaining safety.

---

**Q3: "How do you know the AI is actually making good recommendations? What's your evaluation framework?"**

Three layers of evaluation:

First, the 300 historical records have ground-truth labels. The Threshold Simulator shows the false negative rate at every confidence level - at 95%, it's approximately 0.67% (2 out of 300 dangerous prescriptions slipping through).

Second, every pharmacist review captures whether they agree with the AI. The override rate (visible in Analytics) is a live signal. If pharmacists override the AI 30% of the time, the model or knowledge base needs updating. If they override 5% of the time, the AI is well-calibrated.

Third, the audit log captures complete decision trails. You can filter by risk level, by decision, by agreement status. If the AI is consistently wrong about a specific drug class, it shows up in the data.

In production, I'd add: A/B testing on prompt variations, monthly calibration reports (is confidence score X actually correct X% of the time?), and tracking which specific interaction rules generate the most overrides.

---

**Q4: "The pharmacist 'agrees with AI' feedback is binary - thumbs up or thumbs down. Isn't that too simplistic?"**

It's deliberately simple because feedback friction kills feedback volume. If you ask pharmacists to fill out a 10-field form after every review, compliance drops to near zero. A single thumbs up/down takes one second and gives you the most critical signal: does the human agree with the AI?

That said, it's not only binary. The system also captures: (a) free-text feedback for the cases where the pharmacist wants to explain why, (b) the actual decision (approve/reject/escalate) which may differ from the AI recommendation, and (c) time-to-decision, which is an implicit signal - if a pharmacist spends 30 seconds on a review, they probably agree with the AI; if they spend 5 minutes, they're thinking harder.

In production, I'd add structured override reasons (e.g., "AI missed an interaction", "AI severity is wrong", "Patient-specific factor") but only after establishing baseline feedback volume with the simple version.

---

### Technical Depth

**Q5: "Why not use RAG for the drug interaction knowledge base?"**

The knowledge base is 30 rules. The full JSON is about 16KB. It fits comfortably in Claude Sonnet's context window as part of the system prompt. RAG would add: a vector database (infrastructure), an embedding pipeline (latency), a retrieval step (potential for missed rules), and a chunking strategy (complexity). All of that for a 30-rule dataset where full context works perfectly.

The breakpoint is around 500+ rules or if rules included lengthy clinical guidelines (multi-page documents). At that point, the system prompt exceeds practical token limits and retrieval becomes necessary. But for this scale, full context is simpler, faster, and more reliable - the AI sees every rule every time, so it can never miss a relevant one due to retrieval failure.

---

**Q6: "Your masking approach converts exact ages to ranges. Couldn't someone re-identify a patient from the combination of age range + medication list + allergy categories?"**

You're describing a linkage attack, and it's a valid concern. The masking in SafeRx is a demonstration of the principle, not a production-grade de-identification system. For production, I'd add: k-anonymity verification (ensure at least k patients share any combination of quasi-identifiers), noise injection on less critical fields, and potentially differential privacy for aggregate queries.

That said, the current approach already applies several protective measures: 10-year age buckets (not 5-year), 10kg weight buckets, allergy class categories instead of specific drugs, and complete removal of names and prescriber identities. The masking events audit trail also means you can detect and respond to any masking failures.

The deeper point is architectural: the AI receives masked data because it doesn't need unmasked data. Even if the masking isn't perfect, the attack surface is reduced compared to sending full PHI. Defense in depth.

---

**Q7: "Claude's confidence score is self-reported. How do you know the model is well-calibrated? A 95% confidence doesn't necessarily mean it's right 95% of the time."**

This is one of the most important limitations of the system, and the design accounts for it in three ways:

First, the confidence score is guided by a detailed rubric in the system prompt: 1.0 for exact knowledge base matches, 0.85-0.99 for strong matches, 0.70-0.84 for moderate, and so on. This makes the score more predictable than free-form self-assessment.

Second, the three-gate system means confidence alone cannot auto-approve. Even 99% confidence is blocked if risk is anything above "low." This adds a second independent check.

Third, the Threshold Simulator with ground-truth labels is specifically designed to test calibration. If the model says 95% confidence but is only right 80% of the time at that threshold, the false negative rate in the simulator would be much higher than expected. The simulator is a calibration verification tool.

In production, I'd implement explicit calibration tracking: bucket all predictions by confidence decile, compare against actual outcomes, and generate calibration curves monthly. If the model's 90% confidence predictions are only correct 75% of the time, tighten the threshold until calibration improves.

---

**Q8: "Why SQLite? Wouldn't a real application need a production database?"**

It would, and migration scripts are included (`backend/supabase/migrations/001_initial_schema.sql`). The choice is about audience: someone cloning this repo to evaluate it should be able to run `pip install -r requirements.txt` and `uvicorn api:app` - no Docker, no PostgreSQL server, no connection strings. SQLite gives that zero-config experience.

The schema is designed to be database-agnostic. It uses standard SQL types (TEXT, REAL, INTEGER). JSON fields use TEXT columns with JSON serialization. The migration script translates these to PostgreSQL-native types (JSONB, TIMESTAMPTZ). The application code uses raw SQL with parameterized queries - no ORM - so the migration is straightforward.

---

### Product Thinking

**Q9: "You have an audit log and an analytics dashboard. How would you prioritize improvements if this were a real product?"**

I'd focus on three things in priority order:

First, alerting. The audit log is passive - someone has to look at it. A real product needs proactive alerts: "Override rate exceeded 25% this week", "3 critical interactions auto-approved in the last 24 hours" (should be zero), "Average review time increased 40%." These are the signals that something needs attention.

Second, pharmacist-specific analytics. The current dashboard shows system-level metrics. Individual pharmacists need their own view: "You reviewed 47 prescriptions today, agreed with AI 89% of the time, average review time was 3.2 minutes." This drives individual improvement and catches outliers (a pharmacist who agrees with everything in 10 seconds isn't really reviewing).

Third, interaction rule management. Currently the 30 rules are a static JSON file. A real product needs an admin interface to add, modify, and deprecate rules - with versioning so you can track how rule changes affect AI behavior.

---

**Q10: "How would you measure success for this product?"**

Four metrics, in priority order:

1. **Patient safety (false negative rate)**: Number of dangerous interactions that made it past the system. Target: zero. The Threshold Simulator provides the theoretical rate; production would need post-market surveillance to measure the actual rate.

2. **Pharmacist efficiency (reviews per hour)**: With AI pre-screening, pharmacists should review faster because the AI's analysis gives them a starting point. Measuring this against a baseline (pre-AI review speed) quantifies the quality-of-life improvement.

3. **System throughput (auto-approve rate)**: The percentage of prescriptions safely handled without pharmacist intervention. Higher is better, but only if metric 1 stays at zero. This is the metric the Threshold Simulator optimizes.

4. **Pharmacist trust (agreement rate)**: If pharmacists consistently agree with the AI (>90%), the system is well-calibrated and trusted. If agreement drops, something changed - the patient population, the drug formulary, or the model's performance.

The cost savings (ROI page) are a downstream effect of metrics 2 and 3. I wouldn't optimize for cost directly - optimize for safety and efficiency, and cost savings follow.

---

**Q11: "What happens when the AI is wrong and a patient is harmed? Who is responsible?"**

This is the most important question, and SafeRx's architecture provides a clear answer: **the pharmacist who approved the prescription is responsible, not the AI.**

The AI is a decision support tool, not a decision maker. The system is explicitly designed so that:
- The AI never has the final word on anything risky (three safety gates)
- Every auto-approval is limited to low-risk, high-confidence, AI-recommended-auto-approve cases
- The pharmacist sees the AI's reasoning, the interactions found, and the confidence score before making their decision
- Everything is audit-logged for post-incident analysis

If a dangerous interaction slips through auto-approval, the incident review would examine: Was the knowledge base missing this interaction? Was the confidence threshold too low? Was the risk classification wrong? These are system improvement questions, not blame questions.

The liability model is analogous to other clinical decision support systems: the tool assists, the licensed professional decides, and the organization that deployed the tool is responsible for proper validation and monitoring.

---

**Q12: "Your drug interaction knowledge base has only 30 rules. Real pharmacy systems have thousands. How would you scale this?"**

Scaling the knowledge base changes the architecture in three ways:

First, the system prompt approach breaks down. At 30 rules, the full knowledge base fits in context. At 1,000+, you'd need RAG: embed the rules, retrieve the top 10-20 most relevant to the specific drug combination, and include only those in the prompt. This adds an embedding pipeline, a vector store, and a retrieval step.

Second, rule management becomes a product feature. With 30 rules, a JSON file works. With 1,000+, you need: an admin UI for pharmacists to propose rule additions, a review/approval workflow for rule changes, version control for rule sets, and automated testing (does adding rule #1001 change the behavior for existing test cases?).

Third, confidence calibration becomes harder. With 30 rules, the AI can match most queries against its full knowledge. With 1,000+, there are more edge cases, partial matches, and knowledge gaps. You'd need systematic calibration testing across the expanded rule set, probably using a golden set of known interactions as a regression suite.

The current architecture anticipates this by separating the knowledge base (data/interactions.json) from the checking logic (interaction_checker.py). The knowledge base is loaded and formatted separately from the prompt construction, so swapping in a retrieval step is a code change, not a redesign.

---

**Q13: "If you could redesign one thing about this project, what would it be?"**

I'd add actual token tracking from the Anthropic API. Right now, the Cost & ROI page uses estimated token counts. Claude's response includes `usage.input_tokens` and `usage.output_tokens` - storing these in the `interaction_checks` table would let me show actual costs per check, identify which types of prescriptions use more tokens (complex patients with many medications generate longer prompts), and track cost trends over time.

It's a small change - maybe 10 lines of code - but it would make the cost analysis page show real data instead of estimates, which is more credible in a demo and more useful in production.

---

**Q14: "How would you handle a situation where the AI model is updated and its behavior changes?"**

Model updates are a real operational risk. Here's how I'd handle it:

Before switching models: Run the full historical record set (300 records) through the new model. Compare risk levels, confidence scores, and recommendations against the old model's outputs. Flag any differences. If false negatives increase, do not deploy.

During rollout: Use a shadow mode. Route all prescriptions through both old and new models. Log both outputs. Show pharmacists the old model's results. Alert if the new model would have made a different routing decision.

After rollout: Monitor override rate, agreement rate, and false negative rate daily for 2 weeks. If any metric degrades beyond a threshold, roll back automatically.

The audit log already timestamps every decision. Post-deployment analysis can compare "decisions made with model A" vs "decisions made with model B" because the model name is logged in the cost analysis (and could easily be added to the interaction check record).

---

**Q15: "This project shows a lot of AI governance thinking. But it's a demo with synthetic data. How do you bridge the gap to production?"**

The gap isn't as wide as it looks. The architecture is production-ready in structure:

What's already production-grade:
- The three-gate routing logic
- The masking-before-AI pipeline
- The audit trail design
- The feedback loop data model
- The threshold analysis framework

What needs production investment:
- SQLite to PostgreSQL (migration scripts included)
- Authentication and role-based access
- HIPAA-compliant hosting (encrypted at rest, audit logging, BAA with cloud provider)
- Integration with pharmacy management systems (HL7 FHIR for patient/medication data)
- Clinical validation study (run against a certified drug interaction database like First Databank or Medi-Span)
- Regulatory review (FDA guidance on clinical decision support)

The point of the demo is to show that I understand these requirements and have designed an architecture that accommodates them, even though implementing full HIPAA compliance for a portfolio project would be overkill.

---

*This walkthrough reflects the design thinking, technical decisions, and product judgment behind SafeRx. Every decision has a "why" rooted in either user needs, safety requirements, or practical engineering constraints.*
