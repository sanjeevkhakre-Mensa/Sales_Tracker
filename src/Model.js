/**
 * Model.js — PURE business logic for Live SO Tracker.
 * No Apps Script APIs, no outer-scope references: ModelFactory must stay
 * self-contained so its source can be shipped to the browser via
 * ModelFactory.toString() and re-instantiated there.
 * Rules/aliases are passed in from Config.js; never hard-code them here.
 */
function ModelFactory() {
  'use strict';

  var VERSION = '0.2.0';

  /** Lowercase, trim, treat "_" and runs of whitespace as one space. */
  function normalizeHeader(h) {
    return String(h == null ? '' : h).toLowerCase().replace(/[_\s]+/g, ' ').trim();
  }

  /**
   * Map canonical fields to column indexes. Exact alias match first, then "contains".
   * @return {{index: Object<string,number>, missing: string[]}}
   */
  function mapColumns(headerRow, aliases, required) {
    var norm = headerRow.map(normalizeHeader);
    var index = {};
    Object.keys(aliases).forEach(function (field) {
      var list = aliases[field].map(normalizeHeader);
      var at = -1;
      for (var i = 0; i < list.length && at < 0; i++) at = norm.indexOf(list[i]);
      for (var j = 0; j < list.length && at < 0; j++) {
        for (var k = 0; k < norm.length; k++) {
          if (norm[k] && norm[k].indexOf(list[j]) > -1) { at = k; break; }
        }
      }
      if (at > -1) index[field] = at;
    });
    var missing = (required || []).filter(function (f) { return !(f in index); });
    return { index: index, missing: missing };
  }

  /** "1,244.02" / "₹ 1,244" / "" / 12 → number (0 when blank or invalid). */
  function parseAmount(v) {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var s = String(v == null ? '' : v).replace(/[₹,\s]/g, '');
    if (!s) return 0;
    var n = Number(s);
    return isFinite(n) ? n : 0;
  }

  var MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /**
   * SO date → "yyyy-MM-dd" (calendar date as written; dump dates are IST local).
   * Accepts dd-mm-yyyy[ HH:mm[:ss]], dd/mm/yyyy, yyyy-mm-dd[...], "Month D, YYYY".
   */
  function parseSoDate(v) {
    var s = String(v == null ? '' : v).trim();
    if (!s) return null;
    var m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?!\d)/.exec(s);
    if (m) return valid(+m[3], +m[2], +m[1]);
    m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?!\d)/.exec(s);
    if (m) return valid(+m[1], +m[2], +m[3]);
    m = /^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})$/.exec(s);
    if (m && MONTHS[m[1].toLowerCase()]) return valid(+m[3], MONTHS[m[1].toLowerCase()], +m[2]);
    return null;
    function valid(y, mo, d) {
      if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
      return y + '-' + pad2(mo) + '-' + pad2(d);
    }
  }

  function titleCase(s) {
    return String(s).toLowerCase().replace(/\b[a-z]/g, function (c) { return c.toUpperCase(); });
  }

  /**
   * Customer master table → { CODE: {owner, rsm, region, name} }. First row per code wins.
   * Non-person owners (config.NON_OWNER_VALUES) become "Unassigned".
   */
  function indexCustomers(table, config) {
    var out = {};
    if (!table || !table.length) return out;
    var map = mapColumns(table[0], config.CUSTOMER_COLUMNS, ['code', 'owner']);
    if (map.missing.length) return out;
    var ix = map.index, skip = config.NON_OWNER_VALUES.map(normalizeHeader);
    for (var r = 1; r < table.length; r++) {
      var row = table[r];
      var code = String(row[ix.code] == null ? '' : row[ix.code]).trim().toUpperCase();
      if (!code || out[code]) continue;
      var rawOwner = String(row[ix.owner] == null ? '' : row[ix.owner]).trim();
      out[code] = {
        owner: skip.indexOf(normalizeHeader(rawOwner)) > -1 ? 'Unassigned' : titleCase(rawOwner),
        rsm: 'rsm' in ix ? titleCase(String(row[ix.rsm] || '').trim()) : '',
        region: 'region' in ix ? String(row[ix.region] || '').trim() : '',
        name: 'name' in ix ? String(row[ix.name] || '').trim() : ''
      };
    }
    return out;
  }

  /**
   * Dump table (header + rows) → report snapshot grouped by SO.
   * opts: {config, customers, month:"yyyy-MM", asOf, ingestedAt, source:{msgId,file}}
   * Throws Error("MISSING_COLUMNS: …") when required columns are absent.
   */
  function buildSnapshot(table, opts) {
    var config = opts.config;
    var map = mapColumns(table[0] || [], config.COLUMNS, config.REQUIRED);
    if (map.missing.length) throw new Error('MISSING_COLUMNS: ' + map.missing.join(', '));
    var ix = map.index;
    var types = (config.SCOPE.soTypes || []).map(function (t) { return String(t).toUpperCase(); });
    var known = {};
    config.STATUSES.forEach(function (s) { known[s.key] = s; });
    var customers = opts.customers || {};

    var bySo = {}, order = [], unknown = {}, unmapped = {};
    var stats = { rowsIn: Math.max(0, table.length - 1), rowsKept: 0, droppedType: 0, droppedMonth: 0, droppedBadDate: 0 };

    for (var r = 1; r < table.length; r++) {
      var row = table[r];
      if (!row || row.join('') === '') { stats.rowsIn--; continue; }
      var get = function (f) { return f in ix ? row[ix[f]] : ''; };
      var type = String(get('soType') || '').trim().toUpperCase();
      if (types.length && 'soType' in ix && types.indexOf(type) < 0) { stats.droppedType++; continue; }
      var date = parseSoDate(get('soDate'));
      if (!date) { stats.droppedBadDate++; continue; }
      if (config.SCOPE.currentMonthOnly && date.slice(0, 7) !== opts.month) { stats.droppedMonth++; continue; }

      var so = String(get('soNo')).trim();
      var status = String(get('soStatus') || '').trim().toUpperCase().replace(/\s+/g, '_');
      if (!known[status]) unknown[status] = true;
      var code = String(get('buyerCode') || '').trim().toUpperCase();
      var cust = customers[code];
      if (!cust) unmapped[code] = true;
      var amount = parseAmount(get('amount'));

      var rec = bySo[so];
      if (!rec) {
        rec = bySo[so] = {
          so: so, c: code, b: String(get('buyer') || '').trim(),
          o: cust ? cust.owner : 'Unmapped', d: date, st: status,
          po: String(get('poNo') || '').trim(), amt: 0, lines: []
        };
        order.push(so);
      }
      rec.amt += amount;
      rec.lines.push([
        String(get('sku') || '').trim(), String(get('skuName') || '').trim(),
        parseAmount(get('qty')), parseAmount(get('invoicedQty')), parseAmount(get('cancelledQty')), amount
      ]);
      stats.rowsKept++;
    }

    var sos = order.map(function (k) { var s = bySo[k]; s.amt = Math.round(s.amt * 100) / 100; return s; });
    var statuses = config.STATUSES.map(function (s) { return { key: s.key, label: s.label, bucket: s.bucket }; });
    Object.keys(unknown).forEach(function (k) { statuses.push({ key: k, label: titleCase(k.replace(/_/g, ' ')), bucket: 'OTHER' }); });

    stats.capWarning = stats.rowsIn >= (config.ROW_CAP_WARN || Infinity);
    return {
      v: 1,
      asOf: opts.asOf || null,
      ingestedAt: opts.ingestedAt || null,
      month: opts.month,
      scope: { soTypes: types, currentMonthOnly: !!config.SCOPE.currentMonthOnly },
      source: opts.source || {},
      stats: stats,
      statuses: statuses,
      exclude: (config.EXCLUDE_FROM_REPORT || []).slice(),
      unknownStatuses: Object.keys(unknown),
      unmappedBuyers: Object.keys(unmapped).filter(Boolean),
      sos: sos
    };
  }

  /**
   * Pick the dump to ingest from every message in the matching thread(s).
   * The hourly alerts trail in ONE Gmail thread, so: newest message that carries the CSV wins.
   * Returns its id, or null when that newest dump was already processed (older ones are superseded).
   * @param {Array<{id:string, time:number, hasCsv:boolean}>} messages
   * @param {Object<string,boolean>} processed  ids already ingested
   */
  function pickLatestDump(messages, processed) {
    var withCsv = (messages || []).filter(function (m) { return m && m.hasCsv; });
    if (!withCsv.length) return null;
    withCsv.sort(function (a, b) { return b.time - a.time; });
    var newest = withCsv[0];
    return processed && processed[newest.id] ? null : newest.id;
  }

  /** Minimal RFC 4180 CSV parser (quotes, escaped quotes, CRLF). Used by tests and local preview. */
  function parseCsv(text) {
    var rows = [], row = [], field = '', i = 0, q = false, s = String(text);
    if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1);
    for (; i < s.length; i++) {
      var ch = s[i];
      if (q) {
        if (ch === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else q = false; }
        else field += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && s[i + 1] === '\n') i++;
        row.push(field); rows.push(row); row = []; field = '';
      } else field += ch;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  return {
    VERSION: VERSION,
    normalizeHeader: normalizeHeader,
    mapColumns: mapColumns,
    parseAmount: parseAmount,
    parseSoDate: parseSoDate,
    titleCase: titleCase,
    indexCustomers: indexCustomers,
    buildSnapshot: buildSnapshot,
    pickLatestDump: pickLatestDump,
    parseCsv: parseCsv
  };
}

var Model = ModelFactory();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Model;
  module.exports.ModelFactory = ModelFactory;
}
