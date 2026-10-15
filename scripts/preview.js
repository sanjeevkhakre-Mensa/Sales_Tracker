'use strict';
/**
 * Build dist/preview.html: Dashboard with Styles/App inlined and google.script.run stubbed
 * with a snapshot built from tests/fixtures (never data/**). Open the file in a browser.
 * Usage: node scripts/preview.js [--empty]
 */
const fs = require('node:fs');
const path = require('node:path');
const { Model } = require('../tests/helpers/loadModel');
const CONFIG = require('../src/Config.js');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const snap = Model.buildSnapshot(Model.parseCsv(read('tests/fixtures/so_sku_listing.sample.csv')), {
  config: CONFIG,
  customers: Model.indexCustomers(Model.parseCsv(read('tests/fixtures/customers.sample.csv')), CONFIG),
  month: '2026-10',
  asOf: new Date(Date.now() - 25 * 60000).toISOString(),
  ingestedAt: new Date().toISOString(),
  source: { msgId: 'preview', file: 'SO SKU Listing.csv (fixture)' }
});
const payload = process.argv.includes('--empty') ? null : JSON.stringify(snap);

const stub = '<script>window.google={script:{run:(function(){var ok=function(){},r={' +
  'withSuccessHandler:function(f){ok=f;return r;},withFailureHandler:function(){return r;},' +
  'getDashboardData:function(){var p=' + JSON.stringify(payload) + ';setTimeout(function(){ok(p);},150);}};return r;})()}};</script>';

const html = read('src/Dashboard.html')
  .replace(/<\?!=\s*include\('(\w+)'\)\s*\?>/g, (_, name) => (name === 'App' ? stub : '') + read('src/' + name + '.html'));

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist', 'preview.html');
fs.writeFileSync(out, html);
console.log(out + '  (' + snap.sos.length + ' SOs from fixtures)');
