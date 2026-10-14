# Live SO Tracker (BRND.ME) — Apps Script + Sheet DB
Specs: specs/requirements.md · specs/data-contract.md · specs/design-system.md · Tasks: fix_plan.md

## File map (clasp rootDir=src)
- src/Model.js — PURE logic (no Apps Script APIs). Shared by server, browser (Function.toString), Node tests.
- src/Config.js — ONLY place for column aliases, status map, reason map, internal-cancel rules, schedule.
- src/Store.js sheet I/O · src/Ingest.js Gmail→parse→normalize→diff · src/Notify.js ASM/admin mail
- src/WebApp.js doGet + google.script.run API · src/Setup.js sheets/triggers bootstrap
- src/Dashboard.html shell · src/Styles.html CSS tokens · src/App.html client JS
- tests/*.test.js node --test · scripts/ preview/shot/inspect · tests/fixtures/ synthetic dumps only

## Commands
- npm test · npm run preview (local dashboard on fixtures) · npm run shot (390px + 1440px PNGs) · npm run inspect
- clasp push/deploy and git push: USER ONLY (denied for Claude).

## Hard rules
1. Model.js: no SpreadsheetApp/GmailApp/Utilities/Session/Logger; no globals beyond its namespace; deterministic.
2. Config.js is the single source of aliases/maps/rules. No hard-coded column names or statuses elsewhere.
3. No Date objects over google.script.run — ISO strings only. Timezone Asia/Kolkata.
4. Current month only (by SO date, IST). INTERNAL bucket excluded from Placed and ASM KPIs.
5. Status mapping = longest alias match wins, case/space-insensitive.
6. Every Model change ships with a node test. Tests must pass before marking a task done.
7. ASM sees only own SOs — enforce server-side, never trust client filters.
8. Never read data/** (real dumps). Use tests/fixtures.
9. One fix_plan.md task per loop; tick it, add Learnings if non-obvious.
10. Charts: Chart.js from cdnjs, pinned version, no pie/donut.

## Learnings
- (append: date — lesson)
- 2026-10-14 — Browser gets Model via `(ModelFactory.toString())()`: factory must reference nothing outside itself (Config passed as args). Tests: node --test needs a glob ("tests/**/*.test.js"), not a dir.
- 2026-10-14 — Drive adv service is v3: convert xlsx via Drive.Files.create({name, mimeType:'application/vnd.google-apps.spreadsheet'}, blob), not v2 Files.insert({convert:true}).
- 2026-10-14 — Hourly SO mails (tech@mensabrands.com) all land in ONE Gmail thread; dedupe by message id in RUNS, never by thread/label.
- 2026-10-14 — Dump = Metabase CSV (+PNG); no ASM/narration/cancelled_by/line-status columns; numbers have commas. See data-contract.md Source.
