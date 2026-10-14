# Requirements — Live SO Tracker

## R1 Ingest
- Source mail: from `tech@mensabrands.com` (display "Analytics"), subject "Alert: SO SKU Listing has results", arrives ~HH:02–HH:06 IST, ~3–4 MB attachment.
- Gmail query (Config): `from:tech@mensabrands.com subject:"SO SKU Listing has results" has:attachment newer_than:2d`.
- Gmail groups all hourly mails into ONE thread → iterate messages in matching threads, pick newest unprocessed MESSAGE (never thread-level logic).
- Hourly time trigger with nearMinute(10) so it fires after arrival.
- Script owner / Web App executeAs / ADMIN = sanjeev.khakre@mensabrands.com (recipient of the dump; Config.ADMIN_EMAIL).
- Processed = message id stored in RUNS sheet (labels are thread-level in Gmail, so a label can't mark individual messages).
- xlsx: convert via Drive (Advanced Drive API) to temp Sheet, read values, trash temp. csv: Utilities.parseCsv.
- Grain: line level (SO × SKU). Header row detected by alias match (Config.COLUMNS), not position.
- Missing required column → abort run, log RUNS status=FAILED, alert admin.

## R2 Normalize
- Map raw columns → canonical fields (data-contract.md). Parse dates (dd-mm-yyyy, dd/mm/yyyy, serial, ISO) → ISO IST.
- Amount → number (strip ₹, commas). Trim/case-fold keys.
- Filter: SO date within current IST month. Others dropped (count logged).
- Status → bucket via Config.STATUS_MAP, longest alias wins. Unknown → UNMAPPED (logged, shown to admin).
- SO-level bucket derived from lines (rules in data-contract.md); line status can reject a single SKU.

## R3 Internal cancels
- Bucket INTERNAL if ANY: narration matches Config.INTERNAL.keywords; cancelledBy ∈ Config.INTERNAL.users; SO no ∈ INTERNAL_CANCELS sheet.
- INTERNAL excluded from Placed, all ASM KPIs and ASM emails; visible to ADMIN only.

## R4 Reasons
- Every Cancelled/Rejected line/SO shows raw Narration.
- Narration → reason category via Config.REASON_MAP keywords: STOCK, RATE, CREDIT, PO, SKU_DISCONTINUED, QTY, BUYER, OTHER.
- SKU-level reasons: rejected line inside open SO reported separately.

## R5 Persist + diff
- DATA sheet: full current snapshot (overwrite). HISTORY: per-run KPI snapshot per ASM. EVENTS: diffs.
- Diff vs previous snapshot (key = soNo|sku): NEW_SO, STATUS_CHANGE (from→to bucket), NEW_CANCEL, NEW_REJECT, LINE_REMOVED, AMOUNT_CHANGE.
- Idempotent: re-running same message produces no new EVENTS.

## R6 Roles
- CUSTOMER_MASTER sheet (from user's Custr_Master.xlsx, tab "Cust_code"; Sheet1 = Zoho export, ignore):
  join dump `buyer_code` = master `META CODE`. Gives asm, rsm, ase, zone, region, channel, businessType, empCode, activeL3M.
  Verified 2026-10-14: 53/53 pivot buyers match. 830 master rows have no META CODE (skip). 5 duplicate codes, all consistent → first wins.
- ASM_MASTER: person → email + role (ASM|MANAGER|ADMIN), aliases. Master has names only, no emails.
- SO's ASM = master `AREAS SALES MANAGER/OWNER` (trimmed, case-insensitive vs ASM_MASTER aliases).
  Non-person values (Config.NON_ASM_OWNERS: OTHERS, NA, Dmart, Reliance, INSTITUTIONS, Vacant ASM, Vacant ASE) → asm "UNASSIGNED", still visible to their RSM + admin.
  buyer_code not in master → "UNMAPPED_BUYER" (admin alert).
- MANAGER scope = RSM (`REGION SALES MANGER`) sees buyers where they are RSM; ADMIN sees all.
- Web App: execute as owner, access = domain. Viewer = Session.getActiveUser().getEmail() → role. ASM sees own SOs; MANAGER/ADMIN all.

## R7 Notifications
- Send window: 09:00–21:00 IST, Mon–Sat.
- Per ASM: send only if that ASM's numbers/events changed since last sent, OR at digest hours (Config.DIGEST_HOURS, e.g. 10, 14, 19).
- Content: KPI cards (count, ₹, % placed), new cancels/rejects (SO, buyer, SKUs, narration, reason), approval pending > 24h, dashboard link.
- Managers: all-ASM summary. Admin: run failures, UNMAPPED statuses, unresolved ASMs.
- Stale alert: no new dump for 150 min within window → admin mail (once per gap).
- Quotas: batch, respect MailApp daily quota; log sends in NOTIFY_LOG.

## R8 Dashboard
- Tabs: Overview / ASM / Buyers / Cancel & Reject / SO Detail.
- Buyers tab = user's pivot view: rows buyer_code + buyer, columns so_status (APPROVAL_PENDING, CANCELLED, DELIVERED, DISPATCHED, OPEN, PACKED), values Sum of total amount, Grand Total column + row. Toggle columns: raw status ↔ bucket. Must match the reconciliation pivot in data-contract.md. Filters: ASM, Region, Buyer, date range, search.
- KPI cards per bucket, trend from HISTORY, sortable tables, CSV export, freshness pill (last run time, stale if >150 min).
- See design-system.md.

## Open questions (source gaps, 2026-10-14)
- ~~Q1 ASM~~ → CUSTOMER_MASTER by buyer_code (R6). ~~Q4 Region~~ → master REGION/ZONE.
- Q11 ASM_MASTER emails for the ~17 real ASMs + RSMs (master has none).
- Q2 Narration: no column. Is review_comment the cancel/reject remark? Else need another export column.
- Q3 Cancelled-by: no column → internal cancels only via keywords + INTERNAL_CANCELS sheet unless added.
- Q5 Exclude so_type INTERNAL_STOCK_TRANSFER from all KPIs?
- ~~Q6 Amount basis~~ → `total amount` (confirmed via pivot).
- Q7 Row cap: is the CSV limited to 2,000 rows?
- ~~Q8 so_status values~~ → APPROVAL_PENDING, OPEN, PACKED, DISPATCHED, DELIVERED, CANCELLED.
- Q9 Billed = DISPATCHED + DELIVERED, Open = OPEN + PACKED — confirm. How is a "Rejected" SO identified (no status)?
- Q10 Pivot scope: only distributors (BY0000xx, likely so_type DOMESTIC_OFFLINE) + current month? Dump also has Blinkit/Zepto/Amazon online SOs — include or exclude?

## Non-functional
- Run < 5 min for 20k lines. Batch sheet reads/writes (getValues/setValues once per sheet).
- LockService around ingest. All errors → RUNS + admin mail.
- No PII beyond business data; no external calls except Gmail/Drive/Sheets/cdnjs.
