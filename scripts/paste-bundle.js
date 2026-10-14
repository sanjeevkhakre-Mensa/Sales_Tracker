'use strict';
// Build paste/: one file per Apps Script editor file, for deploying without clasp
// (use when the Apps Script API is unavailable). Run: node scripts/paste-bundle.js
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'paste');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);

// Editor file name → source. Script files become .gs; HTML names must match include('…').
const FILES = [
  ['01 Config.gs', 'Config.js'],
  ['02 Model.gs', 'Model.js'],
  ['03 Store.gs', 'Store.js'],
  ['04 Ingest.gs', 'Ingest.js'],
  ['05 WebApp.gs', 'WebApp.js'],
  ['06 Setup.gs', 'Setup.js'],
  ['07 Dashboard.html', 'Dashboard.html'],
  ['08 Styles.html', 'Styles.html'],
  ['09 App.html', 'App.html'],
  ['10 appsscript.json', 'appsscript.json']
];
FILES.forEach(([name, src]) => fs.copyFileSync(path.join(root, 'src', src), path.join(out, name)));
console.log('wrote', FILES.length, 'files to', path.relative(root, out));
