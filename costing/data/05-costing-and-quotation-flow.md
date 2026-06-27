# Costing & Quotation Flow

Date: 2026-05-28
Source: the dealer Main sheet's real workflow (Quote No, multi-line quotes, revisions 1–4, PO status) + the costing template's pricing ladder.

> **The spine of the whole app.** A *costing* is the engineering calculation of one belt. A *quotation* is one or more costings packaged for a customer, with prices, sent, revised, and eventually won/lost. The dealer sheet already works this way (one Quote No → many belt lines → revisions → PO status).

---

## Object model

```
Customer
   └─ Quotation (Quote No, date, enquiry ref, currency, status)
         └─ QuotationLine  (one per belt — this IS a costing)
               ├─ belt spec (type, width, rating, covers, skim, breakers, edge, qty …)
               ├─ RATE SNAPSHOT  (frozen copy of every master rate used)
               ├─ computed weights & costs (the engine output)
               ├─ pricing (Standard, VD, discount, final)
               └─ revisions[]  (Revised-1 … Revised-n)
```

A single belt costing can also live **standalone** (a quick "what would this cost?") and be promoted into a quotation later.

---

## The lifecycle (and where rates freeze)

```
   ┌─────────────┐   add belt lines    ┌──────────────┐
   │  DRAFT      │ ──────────────────▶ │  PRICED      │
   │ (costing)   │   engine computes   │ (has prices) │
   └─────────────┘   live from masters └──────┬───────┘
                                              │ "Send to customer"
                                              ▼
                                       ┌──────────────┐
                                       │   SENT 🔒    │  ← RATE SNAPSHOT taken here
                                       └──────┬───────┘     (all master rates frozen onto the lines)
                          revise            │            ┌─────────────┐
                       ┌────────────────────┼──────────▶ │ REVISED 🔒  │ (new frozen version, old kept)
                       │                    │            └─────────────┘
                       ▼                    ▼
                 ┌──────────┐         ┌──────────┐
                 │   WON    │         │   LOST   │   (+ PO status, order rate)
                 └──────────┘         └──────────┘
```

### Freeze rule (the thing that fixes "old quotes break when I change a rate")
- While **DRAFT/PRICED**, the costing recomputes live — change a master price and the draft updates. (You're still working on it.)
- The moment it's **SENT**, the system writes a **rate snapshot**: a frozen copy of every compound price, SG, fabric price, freight rate, cost-of-production rate, GP%, discount used on each line.
- Forever after, that sent quote shows exactly what was quoted — even if masters change or a compound is archived. This is the immutability you chose earlier.
- A **revision** doesn't overwrite — it creates a new frozen version (Revised-1, -2 …), so you can always see the history of what you offered and how it changed. (The dealer sheet's Revised-1..4 columns become proper versioned records.)

---

## Quotation header fields
| Field | Source |
|---|---|
| `quote_no` | auto-generated (format like the dealer sheet's `1/HRS/25-26`); confirm scheme |
| `quote_date` | today |
| `customer_id` | → Customer master (pulls default GP%, destination, currency, discount tier) |
| `enquiry_ref` / `enquiry_date` | typed |
| `currency` | INR default; USD/EUR for export (→ exchange rate) |
| `special_note` | free text (the dealer sheet's "Customer specific Note") |
| `status` | DRAFT / PRICED / SENT / REVISED / WON / LOST |

## Quotation line (= one belt costing) fields
All the belt-spec inputs (per `03-belt-type-matrix.md` for that type) + the engine outputs + pricing block:

| Pricing block | From engine |
|---|---|
| `RMC_per_meter` | total cost ÷ length |
| `standard_price` / `standard_per_m` | GP on full cost |
| `vd_price` / `vd_per_m` | GP on material cost only |
| `chosen_basis` | STANDARD or VD (sales picks) |
| `discount_pct` | line discount |
| `final_price` / `final_per_m` | chosen × (1 − discount) — **the headline** |
| `implied_gp_pct` | reverse calc when a custom target price is entered |

## Post-quote tracking (from the dealer sheet)
| Field | Purpose |
|---|---|
| `order_rate` | the rate at which the order was actually procured |
| `actual_gp_received` | (order_rate − RMC) ÷ RMC — did we hold margin? |
| `po_status` | No / Received / etc. |
| `agent` | dealer/distributor attribution |

---

## Why this matches how you already work

The dealer Main sheet is *already* this model, just flattened into 108 columns:
- `Quote No.` + `Sr.no` = quotation header
- each row = a quotation line (one belt)
- `Revised-1..4` columns = revisions (we make them proper versions)
- `RATE @ ORDER PROCURED`, `PO STATUS`, `Agent` = post-quote tracking

We're not inventing a workflow — we're giving the one you already use a real structure, with the rate-freeze that the flat sheet can't do (today, editing Sheet0 silently changes every past quote's numbers — the #1 hidden danger).

---

## Resolved with Jitesh
1. ✅ **Multi-line quote** — yes, one quotation routinely holds many belts. UI supports "add another belt to this quote."
2. ✅ **PO / Won-Lost tracking** — tracked in this app (order rate, PO status, agent, actual GP), but **all optional fields** — a quote is never blocked for lacking them.
3. ✅ **Quote numbering** — deferred; team finalizes exact format during build (architecture doesn't depend on it).

## Still open
- **Approval gate** — part of the separate permissions discussion Jitesh is having with the team. If there's a "manager approves before SENT" step, add a `PENDING_APPROVAL` state before `SENT`. Design leaves room for it.
