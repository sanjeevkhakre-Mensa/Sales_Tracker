/**
 * Ingest.js — time-triggered: newest unprocessed SO SKU Listing mail → snapshot in the Sheet.
 */

function isoIst_(d) {
  return Utilities.formatDate(d, CONFIG.TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function dumpAttachment_(m) {
  return m.getAttachments({ includeInlineImages: false }).filter(function (a) {
    var n = a.getName().toLowerCase();
    return n.indexOf(CONFIG.ATTACHMENT_NAME) > -1 && /\.csv$/.test(n);
  })[0] || null;
}

/**
 * The hourly alerts trail in one Gmail thread: collect every message of every matching
 * thread, then take the NEWEST one carrying the CSV (Model.pickLatestDump).
 */
function findNewDump_(force) {
  var byId = {}, candidates = [];
  GmailApp.search(CONFIG.GMAIL_QUERY, 0, 10).forEach(function (t) {
    t.getMessages().forEach(function (m) {
      var att = dumpAttachment_(m);
      byId[m.getId()] = { msg: m, att: att };
      candidates.push({ id: m.getId(), time: m.getDate().getTime(), hasCsv: !!att });
    });
  });
  var id = Model.pickLatestDump(candidates, force ? {} : Store.processedMessageIds(500));
  return id ? byId[id] : null;
}

/** Trigger entry point. */
function runIngest() {
  ingest_(false);
}

/** Manual: re-process the newest dump even if it was ingested before. */
function ingestLatestNow() {
  return ingest_(true);
}

function ingest_(force) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30 * 1000)) return 'BUSY';
  var started = new Date();
  var run = { runId: Utilities.formatDate(started, CONFIG.TZ, 'yyyyMMdd-HHmmss'), started: isoIst_(started), status: 'OK' };
  try {
    var found = findNewDump_(force);
    if (!found) { checkStale_(); return 'NO_NEW_DUMP'; }
    run.msgId = found.msg.getId();
    run.mailTime = isoIst_(found.msg.getDate());
    run.file = found.att.getName();

    var table = Utilities.parseCsv(found.att.getDataAsString('UTF-8'));
    var customers = Model.indexCustomers(Store.readCustomerTable(), CONFIG);
    var snapshot = Model.buildSnapshot(table, {
      config: CONFIG,
      customers: customers,
      month: Utilities.formatDate(found.msg.getDate(), CONFIG.TZ, 'yyyy-MM'),
      asOf: run.mailTime,
      ingestedAt: isoIst_(new Date()),
      source: { msgId: run.msgId, file: run.file, runId: run.runId }
    });
    if (!Object.keys(customers).length) snapshot.warnings = ['CUSTOMER_MASTER sheet is empty: owners show as Unmapped.'];

    Store.writeSnapshot(snapshot);
    Store.writeData(snapshot, run.runId);
    run.rowsIn = snapshot.stats.rowsIn;
    run.rowsKept = snapshot.stats.rowsKept;
    run.sos = snapshot.sos.length;
    var notes = [];
    if (snapshot.stats.capWarning) notes.push('Possible row cap (' + snapshot.stats.rowsIn + ' rows)');
    if (snapshot.unknownStatuses.length) notes.push('Unknown status: ' + snapshot.unknownStatuses.join(', '));
    if (snapshot.unmappedBuyers.length) notes.push('Unmapped buyers: ' + snapshot.unmappedBuyers.length);
    run.note = notes.join(' · ');
    Store.logRun(run);
    return 'OK';
  } catch (e) {
    run.status = 'FAILED';
    run.note = String(e && e.message || e).slice(0, 500);
    try { Store.logRun(run); } catch (ignored) { /* sheet itself unavailable */ }
    MailApp.sendEmail(CONFIG.ADMIN_EMAIL, '[Live SO Tracker] Ingest failed', run.note + '\n\nRun ' + run.runId);
    throw e;
  } finally {
    lock.releaseLock();
  }
}

/** Alert the admin once per gap when no new dump arrived for STALE_MINUTES (09–21 IST, Mon–Sat). */
function checkStale_() {
  var json = Store.readSnapshotJson();
  if (!json) return;
  var asOf = JSON.parse(json).asOf;
  if (!asOf) return;
  var now = new Date();
  var hour = +Utilities.formatDate(now, CONFIG.TZ, 'H'), dow = +Utilities.formatDate(now, CONFIG.TZ, 'u'); // 1=Mon … 7=Sun
  if (dow === 7 || hour < 9 || hour >= 21) return;
  var ageMin = (now.getTime() - new Date(asOf).getTime()) / 60000;
  var props = PropertiesService.getScriptProperties();
  if (ageMin < CONFIG.STALE_MINUTES) { props.deleteProperty('STALE_ALERTED_FOR'); return; }
  if (props.getProperty('STALE_ALERTED_FOR') === asOf) return;
  MailApp.sendEmail(CONFIG.ADMIN_EMAIL, '[Live SO Tracker] No SO dump for ' + Math.round(ageMin) + ' min',
    'Last dump: ' + asOf + '. Check the Metabase alert "SO SKU Listing".');
  props.setProperty('STALE_ALERTED_FOR', asOf);
}
