/**
 * Setup.js — run setup() once from the Apps Script editor (authorises Gmail, Sheets, Mail).
 */

function setup() {
  var book = Store.ensureDatabase();
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'runIngest') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('runIngest').timeBased().everyMinutes(CONFIG.INGEST_EVERY_MINUTES).create();
  var me = Session.getEffectiveUser().getEmail();
  Logger.log('Running as: ' + me);
  Logger.log('Database: ' + book.getUrl());
  if (me !== CONFIG.ADMIN_EMAIL) book.addEditor(CONFIG.ADMIN_EMAIL);
  MailApp.sendEmail(CONFIG.ADMIN_EMAIL, 'Live SO Tracker — database sheet',
    'Database sheet: ' + book.getUrl() + '\nScript runs as: ' + me +
    '\nNext: paste the Cust_code tab into ' + CONFIG.SHEETS.CUSTOMERS + ', then run ingestLatestNow().');
  Logger.log('Next: paste the "Cust_code" tab of Custr_Master.xlsx into sheet ' + CONFIG.SHEETS.CUSTOMERS +
    ' (keep its header row), then run ingestLatestNow().');
  return book.getUrl();
}
