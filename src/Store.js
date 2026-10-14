/**
 * Store.js — Google Sheet I/O. All reads/writes are batched (one getValues/setValues per sheet).
 */
var Store = (function () {
  var PROP_SS_ID = 'SPREADSHEET_ID';
  var CHUNK = 45000; // < 50,000-char cell limit

  var HEADERS = {
    DATA: ['SO Number', 'SO Date', 'SO Status', 'Buyer Code', 'Buyer', 'Owner', 'PO Number', 'SKU', 'Description', 'Ordered Qty', 'Invoiced Qty', 'Cancelled Qty', 'Amount', 'Run ID'],
    RUNS: ['Run ID', 'Started (IST)', 'Message ID', 'Mail Time (IST)', 'File', 'Status', 'Rows In', 'Rows Kept', 'SOs', 'Note'],
    SNAPSHOT: ['Snapshot JSON (chunked, do not edit)'],
    CUSTOMER_MASTER: ['CUSTOMER ID', 'META CODE', 'Active in L3M', 'CUSTOMER NAME AS PER GST', 'Customer Name', 'TYPE', 'ZONE', 'City', 'STATE', 'BUSINNES TYPE', 'REGION SALES MANGER', 'CHANNEL', 'REGION', 'ASE/BDE', 'AREAS SALES MANAGER/OWNER', 'EMP Code']
  };

  function ss() {
    var id = PropertiesService.getScriptProperties().getProperty(PROP_SS_ID);
    if (!id) throw new Error('Run setup() first: no spreadsheet configured.');
    return SpreadsheetApp.openById(id);
  }

  function sheet(name) {
    var sh = ss().getSheetByName(name);
    if (!sh) throw new Error('Missing sheet "' + name + '". Run setup().');
    return sh;
  }

  /** Create (or adopt) the database spreadsheet and its sheets. */
  function ensureDatabase() {
    var props = PropertiesService.getScriptProperties();
    var id = props.getProperty(PROP_SS_ID), book;
    if (id) { book = SpreadsheetApp.openById(id); }
    else {
      book = SpreadsheetApp.create('Live SO Tracker — DB');
      book.setSpreadsheetTimeZone(CONFIG.TZ);
      props.setProperty(PROP_SS_ID, book.getId());
    }
    Object.keys(CONFIG.SHEETS).forEach(function (k) {
      var name = CONFIG.SHEETS[k];
      var sh = book.getSheetByName(name) || book.insertSheet(name);
      var head = HEADERS[name];
      if (head && sh.getLastRow() === 0) {
        sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
        sh.setFrozenRows(1);
      }
    });
    var blank = book.getSheetByName('Sheet1');
    if (blank && book.getSheets().length > 1 && blank.getLastRow() === 0) book.deleteSheet(blank);
    return book;
  }

  function readCustomerTable() {
    var sh = sheet(CONFIG.SHEETS.CUSTOMERS);
    if (sh.getLastRow() < 2) return [];
    return sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getDisplayValues();
  }

  function processedMessageIds(limit) {
    var sh = sheet(CONFIG.SHEETS.RUNS), last = sh.getLastRow();
    if (last < 2) return {};
    var n = Math.min(limit || 500, last - 1);
    var vals = sh.getRange(last - n + 1, 1, n, 6).getValues(), out = {};
    vals.forEach(function (r) { if (r[2] && r[5] === 'OK') out[String(r[2])] = true; });
    return out;
  }

  function logRun(run) {
    sheet(CONFIG.SHEETS.RUNS).appendRow([
      run.runId, run.started, run.msgId || '', run.mailTime || '', run.file || '',
      run.status, run.rowsIn || 0, run.rowsKept || 0, run.sos || 0, run.note || ''
    ]);
  }

  function writeSnapshot(snapshot) {
    var json = JSON.stringify(snapshot), rows = [];
    for (var i = 0; i < json.length; i += CHUNK) rows.push([json.slice(i, i + CHUNK)]);
    var sh = sheet(CONFIG.SHEETS.SNAPSHOT);
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 1).clearContent();
    sh.getRange(2, 1, rows.length, 1).setNumberFormat('@').setValues(rows);
  }

  /** Snapshot as a JSON string (never Date objects over google.script.run). */
  function readSnapshotJson() {
    var sh = sheet(CONFIG.SHEETS.SNAPSHOT);
    if (sh.getLastRow() < 2) return null;
    return sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().map(function (r) { return r[0]; }).join('');
  }

  /** Line-level DATA sheet: overwritten every run (current snapshot only). */
  function writeData(snapshot, runId) {
    var rows = [];
    snapshot.sos.forEach(function (s) {
      s.lines.forEach(function (l) {
        rows.push([s.so, s.d, s.st, s.c, s.b, s.o, s.po, l[0], l[1], l[2], l[3], l[4], l[5], runId]);
      });
    });
    var sh = sheet(CONFIG.SHEETS.DATA);
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
    if (rows.length) sh.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  }

  return {
    ensureDatabase: ensureDatabase,
    readCustomerTable: readCustomerTable,
    processedMessageIds: processedMessageIds,
    logRun: logRun,
    writeSnapshot: writeSnapshot,
    readSnapshotJson: readSnapshotJson,
    writeData: writeData,
    url: function () { return ss().getUrl(); }
  };
})();
