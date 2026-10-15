/**
 * Config.js — the ONLY place for column aliases, status map, scope rules and schedule.
 * Plain data so it loads in Apps Script, the browser and Node tests.
 */
var CONFIG = {
  TZ: 'Asia/Kolkata',
  ADMIN_EMAIL: 'sanjeev.khakre@mensabrands.com',

  // Hourly Metabase alert. All hourly mails land in ONE Gmail thread → dedupe by message id.
  GMAIL_QUERY: 'from:tech@mensabrands.com subject:"SO SKU Listing has results" has:attachment newer_than:3d',
  ATTACHMENT_NAME: 'so sku listing',            // case-insensitive "contains"; must end with .csv
  INGEST_EVERY_MINUTES: 15,                      // trigger cadence; only new mails are processed
  STALE_MINUTES: 150,                            // freshness pill turns red / admin alert
  ROW_CAP_WARN: 2000,                            // Metabase attachment cap → possible truncation

  SHEETS: { DATA: 'DATA', RUNS: 'RUNS', SNAPSHOT: 'SNAPSHOT', CUSTOMERS: 'CUSTOMER_MASTER' },

  // Dump column aliases (normalized: lowercase, "_" = space). Exact match wins, then "contains".
  COLUMNS: {
    soNo: ['so_number', 'so number', 'so no'],
    soType: ['so_type'],
    soStatus: ['so_status'],
    soDate: ['so_date'],
    poNo: ['po_number'],
    buyerCity: ['buyer_city'],
    buyer: ['buyer'],
    buyerCode: ['buyer_code'],
    sku: ['sku_id'],
    skuName: ['description'],
    qty: ['so_ordered_qty'],
    invoicedQty: ['invoiced_qty'],
    cancelledQty: ['cancelled_qty'],
    amount: ['total amount', 'total_amount']
  },
  REQUIRED: ['soNo', 'soStatus', 'soDate', 'buyerCode', 'amount'],

  // Customer master (Custr_Master.xlsx, tab "Cust_code"). Header typos are real.
  CUSTOMER_COLUMNS: {
    code: ['meta code'],
    owner: ['areas sales manager/owner', 'areas sales manager / owner'],
    rsm: ['region sales manger', 'region sales manager'],
    region: ['region'],
    name: ['customer name'],
    city: ['city']
  },
  // Owner values that are not people → shown as "Unassigned".
  NON_OWNER_VALUES: ['', '-', 'na', 'others', 'dmart', 'reliance', 'institutions', 'vacant asm', 'vacant ase'],

  // Report scope (user decision 2026-10-14): offline SOs dated in the running month (IST).
  SCOPE: { soTypes: ['DOMESTIC_OFFLINE'], currentMonthOnly: true },

  // so_status → bucket. Order = column order in the report.
  STATUSES: [
    { key: 'APPROVAL_PENDING', label: 'Approval pending', bucket: 'PENDING' },
    { key: 'DELIVERED', label: 'Delivered', bucket: 'BILLED' },
    { key: 'DISPATCHED', label: 'Dispatched', bucket: 'BILLED' },
    { key: 'OPEN', label: 'Open', bucket: 'OPEN' },
    { key: 'PACKED', label: 'Packed', bucket: 'OPEN' },
    { key: 'CANCELLED', label: 'Cancelled', bucket: 'CANCELLED' }
  ],
  // Kept in the data, hidden from the report.
  EXCLUDE_FROM_REPORT: ['CANCELLED']
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
