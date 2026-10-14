# Data Contract

## Source (verified 2026-10-14 from live mail)
- Metabase pulse (analytics.mensa.one). Attachments: `SO SKU Listing.csv` (text/csv) + a PNG → pick by `.csv` name/mime.
- ~108 snake_case columns, one row per SO × SKU. Contains SOs from earlier months (Jul/Aug seen) → month filter is mandatory.
- Numbers have thousands commas ("1,244.02"). Dates: `dd-mm-yyyy HH:mm:ss`, `dd-mm-yyyy`, and `Month D, YYYY` (packed_date).
- Email body says "Showing 10 of 2,000 rows" — CHECK whether CSV is capped at 2,000 rows (Metabase limit). If capped, alert admin when rowcount == cap.
- Header names below marked `~` were truncated in the email preview; confirm full name on first real run (prefix match allowed).

| canonical | source column |
|---|---|
| soNo | so_number |
| soType | so_type (DOMESTIC_ONLINE, DOMESTIC_OFFLINE, INTERNAL_STOCK_TRANSFER, …) |
| soStatusRaw | so_status (DELIVERED, CANCELLED, …) |
| poStatus | status |
| soDate | so_date |
| poNumber / poDate / poExpiry | po_number / po_date / po_expiry_date |
| brand | brand |
| channel | master_buyer (Blinkit, Zepto, Amazon - Vendor Central, FBA/FBF, …) |
| buyer / buyerCode | buyer / buyer_code |
| seller | seller |
| sku / skuName / category | sku_id / description / category |
| mrp / unitPrice | mrp / unit_price |
| taxable | ~total taxable am… |
| amount | total amount (incl. tax) — default basis |
| poAmount | po amount (PO-level, do not sum per line) |
| qty / invoicedQty / cancelledQty | so_ordered_qty / invoiced_qty / cancelled_qty |
| invoiceNo / invoiceDate | invoice_number / invoice_date |
| reviewRequired / reviewComment | review_required / review_comment |
| approvalPendingAt | ~approval_pending… |
| markedOpenAt / approvedAt | ~marked_as_open_t… / approved_time |
| buyerCity | buyer_city |

### so_status values (from user pivot, 2026-10-14) → default bucket
| so_status | bucket |
|---|---|
| APPROVAL_PENDING | PENDING |
| OPEN | OPEN |
| PACKED | OPEN |
| DISPATCHED | BILLED |
| DELIVERED | BILLED |
| CANCELLED | CANCELLED (or REJECTED / INTERNAL by narration rules) |
No REJECTED status exists in source → REJECTED must be derived (see open Q2/Q9).

### Reconciliation target (user pivot: Sum of total amount, buyer_code × so_status)
- Amount basis CONFIRMED = `total amount` (incl. GST).
- Pivot grand totals (₹): APPROVAL_PENDING 3,749,237 · CANCELLED 3,213,169 · DELIVERED 608,242 · DISPATCHED 17,493,594 · OPEN 7,648,275 · PACKED 4,008,490 · Total 36,721,007 (53 buyers, all BY0000xx distributors).
- Acceptance: Model.computeKpis on the same dump must equal these per raw status before bucketing (scope/filter to be confirmed, Q5/Q10).

Gaps in source (no column): ASM, region, narration, cancelled_by, line status → see open questions in requirements.md.
Line bucket derivation (no line status): cancelledQty ≥ qty → CANCELLED; invoicedQty ≥ qty → BILLED; invoicedQty > 0 → OPEN (partial); else from SO status.

## Canonical line fields (DATA sheet, one row per SO × SKU)
| field | type | req | notes |
|---|---|---|---|
| soNo | string | Y | trimmed, upper |
| soDate | ISO date (IST) | Y | current-month filter key |
| sku | string | Y | |
| skuName | string | N | |
| qty | number | N | |
| amount | number (₹) | Y | line value, incl/excl GST per Config.AMOUNT_BASIS |
| buyer | string | Y | customer/distributor |
| region | string | N | |
| asmRaw | string | Y | as in dump |
| asm | string | Y | resolved ASM_MASTER name or UNASSIGNED |
| soStatusRaw | string | Y | header status |
| lineStatusRaw | string | N | item status |
| narration | string | N | cancel/reject remark |
| cancelledBy | string | N | user id/name |
| approvalSince | ISO datetime | N | for pending age |
| updatedAt | ISO datetime | N | |
| lineBucket | enum | derived | |
| soBucket | enum | derived | |
| reason | enum | derived | only for CANCELLED/REJECTED |
| isInternal | bool | derived | |
| runId | string | derived | |

Column aliases live ONLY in Config.COLUMNS: `{ soNo: ['so no','so number','sales order',...], ... }`. Header match: lowercase, collapse spaces/punctuation, exact alias equality first, then contains.

## Buckets
| bucket | meaning | color |
|---|---|---|
| PLACED | all non-INTERNAL SOs in month (total) | slate |
| BILLED | fully invoiced | green |
| OPEN | confirmed, not/partially billed (incl. "Partially Billed") | blue |
| PENDING | approval pending | amber |
| CANCELLED | cancelled by customer/ops | grey |
| REJECTED | rejected (approval/credit) | red |
| INTERNAL | own correction cancels | n/a (admin only) |
| UNMAPPED | status not in map | admin warning |

Placed = BILLED + OPEN + PENDING + CANCELLED + REJECTED (count & ₹). % = bucket ₹ / Placed ₹ (also count %).

## Status map (Config.STATUS_MAP)
- alias → bucket; normalize (lowercase, trim, collapse spaces); pick the LONGEST alias contained in status.
- e.g. "billed"→BILLED, "partially billed"→OPEN, "cancelled"→CANCELLED, "pending for approval"→PENDING, "rejected"→REJECTED.

## Line → SO bucket rules (in order)
1. Any line isInternal or SO in INTERNAL_CANCELS → INTERNAL (whole SO).
2. soStatusRaw maps to CANCELLED/REJECTED → that bucket.
3. All lines REJECTED → REJECTED; all CANCELLED → CANCELLED.
4. Any line PENDING → PENDING.
5. All non-rejected/cancelled lines BILLED → BILLED.
6. Else OPEN. Rejected/cancelled lines within → SKU-level events (amount counted in line bucket, not SO bucket).

## Reason categories (Config.REASON_MAP, keyword lists)
STOCK, RATE, CREDIT, PO, SKU_DISCONTINUED, QTY, BUYER, OTHER (fallback; also blank narration).

## Sheets
- DATA: canonical fields. RUNS: runId, msgId, receivedAt, startedAt, status, rowsIn, rowsKept, error.
- EVENTS: runId, at, type, soNo, sku, asm, fromBucket, toBucket, amount, narration, reason.
- HISTORY: runId, at, asm, bucket, count, amount.
- ASM_MASTER: name, aliases, email, role, region, active. INTERNAL_CANCELS: soNo, note, addedBy, addedAt.
- NOTIFY_LOG: at, to, asm, kind, hash. CONFIG_OVERRIDES (optional key/value).

## Client payload (google.script.run)
`{ generatedAt: ISO, lastRunAt: ISO, viewer: {email, role, asm}, kpis, lines: [...], events: [...], history: [...] }` — no Date objects.
