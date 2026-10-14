# Design System — enterprise (Stripe/Linear-like)

## Foundations
- Font: Inter (Google Fonts) 400/500/600; tabular-nums for figures. Sizes 12/14/16/20/28.
- Spacing: 8px grid (4 allowed for tight inline). Radius 8 (cards), 6 (inputs), 999 (pills).
- Elevation: 1px border + subtle shadow; no heavy gradients.
- Tokens on :root in Styles.html; dark mode via prefers-color-scheme + [data-theme] toggle.

## Palette (slate neutral)
| token | light | dark |
|---|---|---|
| --bg | #f8fafc | #0b1220 |
| --surface | #ffffff | #111827 |
| --border | #e2e8f0 | #1f2937 |
| --text | #0f172a | #e5e7eb |
| --muted | #475569 | #94a3b8 |
| --accent | #4f46e5 | #818cf8 |

Bucket semantic colors (one each; text uses darker shade for AA):
| bucket | fill | text-on-surface |
|---|---|---|
| Placed | #334155 | #334155 / #cbd5e1 |
| Billed | #16a34a | #15803d / #4ade80 |
| Open | #2563eb | #1d4ed8 / #60a5fa |
| Pending | #d97706 | #b45309 / #fbbf24 |
| Cancelled | #64748b | #475569 / #94a3b8 |
| Rejected | #dc2626 | #b91c1c / #f87171 |
All text ≥ 4.5:1, UI/graphics ≥ 3:1 (WCAG AA). Never color alone — always label.

## Number format
- ₹ Indian: <1L → ₹12,345; ≥1L → ₹12.3 L; ≥1Cr → ₹1.24 Cr. Counts with en-IN grouping. % one decimal.
- Formatter lives in Model.js (shared with email).

## Layout
- Sticky header: logo/title, freshness pill (green <70 min, amber <150, red ≥150, shows "Updated 14:05 IST"), viewer role, theme toggle.
- Filter bar: ASM, Region, Buyer (multi-select), date range, search (SO/SKU/buyer). Sticky under header on desktop; collapsible sheet on mobile.
- Tabs: Overview / ASM / Buyers / Cancel & Reject / SO Detail. URL hash keeps tab + filters.

## Components
- KPI card: label, count (large), ₹ value, % of placed, left 3px bucket color bar, delta vs last run.
- Table: sticky head, sortable (aria-sort), right-aligned numerics, zebra off, row hover, pagination 50, CSV export button (exports current filtered rows).
- Pivot table (Buyers tab): sticky first column (code + buyer) and header; status columns in fixed order, header tinted with bucket color; zero shown as "–" (muted); full rupees en-IN grouping (₹10,36,038), tabular-nums, right-aligned; sticky Grand Total row (bold, top border); every column sortable; click a cell → SO Detail filtered to buyer + status; toggle Raw status / Bucket; CSV export. At 390px scrolls inside its container only.
- Narration cell: truncated 1 line + tooltip/expand; reason as pill.
- Empty / loading (skeleton) / error states for every panel.

## Charts (Chart.js, cdnjs, pinned version)
- No pie/donut. Use: stacked horizontal bar (bucket mix per ASM), line (hourly trend from HISTORY), bar (reasons ranked).
- Bucket colors from tokens; gridlines --border; tooltips formatted ₹ L/Cr.

## Responsive
- Breakpoints: 390 (base), 768, 1280. At 390px: single column cards (2-up for KPIs), tables become stacked cards or scroll inside container only — never page-level horizontal scroll. 16px side gutter.
- Touch targets ≥ 44px.

## Accessibility
- Keyboard: tabs (roving tabindex), sortable headers are buttons, visible focus ring (--accent 2px).
- aria-live on freshness + filter result count. Respect prefers-reduced-motion.

## Email (Notify)
- Inline CSS, table layout, 600px max, same bucket colors, KPI cards as 3×2 grid, light only.
