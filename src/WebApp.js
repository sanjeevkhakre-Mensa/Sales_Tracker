/**
 * WebApp.js — serves the Order Intelligence (domain-only web app).
 */

function doGet() {
  return HtmlService.createTemplateFromFile('Dashboard')
    .evaluate()
    .setTitle('Order Intelligence')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Inline another project HTML file (Styles, App). */
function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/** Latest snapshot as a JSON string, or null before the first ingest. */
function getDashboardData() {
  return Store.readSnapshotJson();
}
