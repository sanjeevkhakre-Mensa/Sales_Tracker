# fix_plan — one task per loop; tick when tests pass

## P0 — core pipeline
- [x] Init repo files: .clasp.json (rootDir=src), src/appsscript.json (tz Asia/Kolkata, webapp DOMAIN, Drive adv service), .gitignore
- [x] Model: UMD-style namespace skeleton + test harness loading src/Model.js in Node
- [ ] Config: COLUMNS aliases, STATUS_MAP, REASON_MAP, INTERNAL rules, schedule constants
- [ ] Model.normalizeHeader + mapColumns (alias exact→contains) + tests
- [ ] Model.parseDate (dd-mm-yyyy, dd/mm/yyyy, serial, ISO) → ISO IST + tests
- [ ] Model.parseAmount (₹, commas, blanks) + tests
- [ ] Model.mapStatus longest-alias-wins + tests (Partially Billed → OPEN)
- [ ] Model.isCurrentMonth (IST boundaries) + tests
- [ ] Model.isInternal (keywords, users, sheet SO list) + tests
- [ ] Model.reasonFor(narration) + tests
- [ ] Model.normalizeRows (raw table → canonical lines) + tests
- [ ] Model.deriveSoBucket (line→SO rules) + tests
- [ ] Model.pivot(lines, rowKeys, colKey, valueKey) → {rows, cols, totals} + tests (reproduce user's buyer × so_status pivot)
- [ ] Model.computeKpis (per bucket count/₹/% , Placed excludes INTERNAL) + tests
- [ ] Model.diffSnapshots → EVENTS (idempotent) + tests
- [ ] Model.resolveAsm (aliases) + tests
- [ ] tests/fixtures: synthetic csv dump (≥40 lines, all buckets, internal, partial reject)
- [ ] Store: ensureSheets + read/write DATA, RUNS, EVENTS, HISTORY (batched)
- [ ] Store: read ASM_MASTER, INTERNAL_CANCELS
- [ ] Ingest: Gmail find newest unprocessed message (iterate thread messages, dedupe via RUNS msgId)
- [ ] Ingest: attachment → 2D array (csv parse; xlsx via Drive convert + trash)
- [ ] Ingest: runIngest orchestration with LockService + RUNS logging
- [ ] Setup: setup() creates sheets, headers, hourly trigger

## P1 — notify + dashboard
- [ ] Model.fmtINR (L/Cr) + fmtPct + tests
- [ ] Model.shouldNotify (window 9–21 Mon–Sat, change hash, digest hours) + tests
- [ ] Model.pendingOver24h + tests
- [ ] Notify: ASM email HTML (KPI cards, cancel/reject list, pending>24h, link)
- [ ] Notify: manager summary + NOTIFY_LOG
- [ ] Notify: stale-dump alert (150 min, once per gap) + admin failure/UNMAPPED alert
- [ ] WebApp: doGet + role resolution + server-side row scoping
- [ ] WebApp: getDashboardData() payload (ISO strings only)
- [ ] Styles.html: tokens, light/dark, base components
- [ ] Dashboard.html shell: sticky header, freshness pill, tabs, filter bar
- [ ] App.html: inject Model via Function.toString, state + filters + URL hash
- [ ] Overview tab: KPI cards + trend line + ASM stacked bar
- [ ] ASM tab: sortable ASM table
- [ ] Buyers tab: pivot table (buyer × so_status, sum total amount, grand totals, raw/bucket toggle, drill-down, CSV)
- [ ] Cancel & Reject tab: list with narration, reason pills, SKU-level rows, reasons bar
- [ ] SO Detail tab: search + line table
- [ ] CSV export of filtered rows
- [ ] scripts/preview.js: serve Dashboard with fixture payload + google.script.run stub
- [ ] scripts/shot.js: Playwright screenshots 390px/1440px light+dark
- [ ] scripts/inspect.js: print fixture KPIs/events summary

## P2 — hardening
- [ ] 390px audit: no horizontal scroll (shot + scrollWidth check)
- [ ] WCAG AA contrast check of tokens (script)
- [ ] Perf: 20k-line fixture < budget in Node; batch-write audit
- [ ] UNMAPPED status admin panel
- [ ] CONFIG_OVERRIDES sheet merge into Config
- [ ] HISTORY retention/archival (keep current month + 1)
- [ ] README deploy steps (clasp login/push/deploy — user runs)
