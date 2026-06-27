# Team "flow.docx" vs Our Spec — Comparison

Date: 2026-05-28
Reviewed: `flow.docx` (team member's working UI design, WIP — references Costing Mindmap, Multi-Ply sheet, CDS/dealer sheet).

> **Headline:** Strong work — ~80% aligned. It faithfully digitises the **current** dealer costing sheet (fields, overrides, CD/VD pricing, revisions, PO status). Our spec adds the **architectural upgrades** (unified Compound Master, selectable skim, Ravasco link). The two are complementary: keep the team's excellent field-level UI; upgrade the master layer underneath. **One critical gap: the selectable skim compound — Jitesh's original ask — is not in the team design yet.**

---

## ✅ Where the team flow MATCHES our spec (keep as-is)

| Area | Team flow | Our spec | Status |
|---|---|---|---|
| Belt Rating by concatenation | Fabric + Strength + Ply → Belt Rating | Belt Rating master (Level C) decodes the same | ✅ same idea |
| Product → Conveyor type | Product Master → Belt_type master | ProductCategory → SubCategory (Ravasco) | ✅ aligned |
| Customer-driven header | Customer Master, special note from email | Quote header from Customer master | ✅ aligned |
| Construction open/endless | Toggle | Length rule (×1.03 vs +3 m) | ✅ aligned |
| Override-everything pattern | Blank = master, else override (CCT, TBT, SG, rates) | "type default + per-item override" | ✅ aligned & extended |
| VD pricing | Quotation Rate CD + VD side by side | Standard + VD side by side | ✅ aligned |
| Per-meter costing | All weights/costs per meter | engine computes per-meter equivalently | ✅ aligned |
| Revisions + PO status | Revision 1–4, Order Rate, Actual GP, PO Status | quote revisions + optional PO tracking | ✅ aligned |
| Multi-supplier fabric | MIT / SRF / others (Fabric_Make) | multi-supplier locked | ✅ aligned |
| Breaker skim selectable | Skim Type from skim master | breaker skim from compound role=SKIM | ✅ aligned |

---

## ⭐ GOOD IDEAS in the team flow we should ADOPT into our spec

1. **Unit System (Metric/Imperial) toggle** — interchangeable on user preference. Our spec under-specified this; the original Excel had it. **Adopt:** add a unit-system setting that converts width/length/thickness display; store canonical in metric.
2. **Calculated vs Actual belt weight** — "Actual Belt Weight/m (manual)" alongside calculated. From the dealer sheet (AO/AP). Lets you capture the real measured weight vs theoretical. **Adopt** into the engine output.
3. **Floating / Non-Floating breaker** — a breaker construction attribute we didn't capture. Affects how the breaker sits in the belt. **Adopt** as a field on the breaker selection.
4. **"Rating Manufacturing" vs "Rating Display"** — two ratings (what's made vs what's shown to the customer). Useful nuance. **Adopt / clarify** with the team what drives the difference.
5. **Granular rating masters** — Belt_Breaking_Master, No_of_Ply_master as separate masters that concatenate into Belt Rating. More normalised than our single Belt Rating master. **Either works**; theirs is fine.
6. **Floor Price / BW** explicitly shown — the break-even/minimum price line. Good to surface (we had it as RMC; "Floor Price" is clearer for sales).

---

## ⚠️ IMPORTANT GAPS / DIVERGENCES to raise with the team

### 1. 🔴 Selectable SKIM compound — the original ask — is missing
- **Team flow:** carcass skim rate appears only as a manual override ("Skim Rate (Rs/kg)") and is otherwise bundled into **Grade_master** (grade → cover rate + skim rate together, exactly like the old dealer Sheet0).
- **Our spec:** skim is a **first-class compound** you select from the compound list (role = SKIM), with recommended-first ordering and a mismatch warning — *this is the exact feature Jitesh asked for ("we have not added an option of selecting a different Skim compound if required")*.
- **Why it matters:** without this, you're back to the old behaviour where skim is locked to the grade. The whole skim-matching engine (`02c`) isn't realised.
- **Action:** add a **Skim Compound** selector in the cover/carcass section (not just for breakers), pulling from the compound master.

### 2. 🔴 No unified Compound Master with roles (the architectural heart)
- **Team flow:** keeps separate **Grade_master** (cover, with bundled cover+skim rates) and **skim master** (breakers). This is the current dealer-sheet structure.
- **Our spec:** ONE **Compound Master** where each compound has a role (Top Cover, Bottom Cover, Skim, Sidewall, Cleat…) and a price that — later — comes live from Ravasco's recipe (`02`, `02b`).
- **Why it matters:** the unified master is what unlocks (a) selectable skim, (b) **separable top/bottom cover**, (c) **cross-use with warnings**, and (d) **Ravasco integration** (price from recipe = your single source of truth). Bundling rates into Grade keeps prices typed-in forever.
- **Action:** restructure Grade_master + skim master into one Compound Master with a `role` field. The UI can still *look* the same; the data model underneath changes.

### 3. 🟠 Top & Bottom cover use a single "Grade"
- **Team flow:** one **Grade** dropdown for the whole belt.
- **Our spec (locked):** top and bottom cover can be **different compounds** (default same, override allowed) — a flexibility gain you confirmed.
- **Action:** allow a separate bottom-cover compound (optional).

### 4. 🟠 No Edge Type (Cut-Edge / Moulded) — width-wastage bug not addressed
- **Team flow:** no edge-type selector visible.
- **Our spec:** Edge master drives width wastage (Cut-Edge +30 mm, Moulded +0) — fixes bug C8. The original Multiply sheet *had* "Edge Type".
- **Action:** add Edge Type selection; wastage parametrised by edge.

### 5. 🟡 Width from a Width_Master (dropdown) vs free entry
- **Team flow:** Width is a dropdown from Width_Master.
- **Consideration:** belts are often quoted at **custom widths**. A fixed master list may block custom orders.
- **Action:** confirm — free numeric entry with common presets is usually safer than a closed list.

---

## ❓ Clarifications — RESOLVED with Jitesh

1. ✅ **Multi-belt quote** — YES. "Sr. No" is the **line number** within a quotation. One quotation → many belt lines. Schema must model Quotation → QuotationLine.
2. ✅ **Rate freeze on send** — to be ADDED. Backend must snapshot all rates when a quote is sent so master changes never rewrite old quotes.
3. ✅ **Width** — stays a **dropdown from Width_Master** (Jitesh's call, to avoid manual entry errors). Width_Master is included in the templates/schema. (Custom widths handled by adding rows to the master.)
4. ✅ **Other belt types** — YES, the screen shows/hides only the **applicable fields** per belt type (our "one engine, components toggled" model, `03`).

---

## Suggested message back to the team
> "Great start — the field layout, override pattern, CD/VD pricing, revisions and PO tracking all match what we want. Two structural changes before you go further: (1) make **skim a selectable compound** (not bundled in Grade) — this was the original requirement; (2) merge **Grade_master + skim master into one Compound Master with a 'role' field** so we get separable top/bottom cover and a clean path to pull live prices from the Ravasco formulation app later. Also add **Edge Type** (cut/moulded) since it drives width wastage. See `00-START-HERE.md` and `02c` for the skim/compound design."
