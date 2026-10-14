/**
 * Setup.js — run setup() once from the Apps Script editor (authorises Gmail, Sheets, Mail).
 */

function setup() {
  var book = Store.ensureDatabase();
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'runIngest') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('runIngest').timeBased().everyMinutes(CONFIG.INGEST_EVERY_MINUTES).create();
  Logger.log('Database: ' + book.getUrl());
  Logger.log('Next: paste the "Cust_code" tab of Custr_Master.xlsx into sheet ' + CONFIG.SHEETS.CUSTOMERS +
    ' (keep its header row), then run ingestLatestNow().');
  return book.getUrl();
}
