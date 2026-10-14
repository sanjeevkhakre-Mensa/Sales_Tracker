'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers/loadModel');

const FORBIDDEN = [
  'SpreadsheetApp', 'GmailApp', 'MailApp', 'DriveApp', 'Drive.', 'Utilities',
  'Session', 'Logger', 'PropertiesService', 'CacheService', 'LockService',
  'ScriptApp', 'HtmlService', 'UrlFetchApp', 'google.script'
];

test('loads via require (node)', () => {
  const Model = h.loadNode();
  assert.equal(typeof Model.VERSION, 'string');
  assert.equal(typeof Model.ModelFactory, 'function');
});

test('loads as plain script in shared global scope (Apps Script)', () => {
  const { Model, ModelFactory } = h.loadGas();
  assert.equal(typeof ModelFactory, 'function');
  assert.equal(Model.VERSION, h.loadNode().VERSION);
});

test('factory survives Function.toString round-trip (browser)', () => {
  const browser = h.loadBrowser();
  const node = h.loadNode();
  const apiKeys = (m) => Object.keys(m).filter((k) => k !== 'ModelFactory').sort();
  assert.deepEqual(apiKeys(browser), apiKeys(node));
  assert.equal(browser.VERSION, node.VERSION);
});

test('Model.js uses no Apps Script / browser-bridge APIs', () => {
  const code = h.source().replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  for (const id of FORBIDDEN) {
    assert.ok(!code.includes(id), 'Model.js must stay pure; found ' + id);
  }
});

test('Model.js creates no Date objects at module load', () => {
  const code = h.source();
  assert.ok(!/new Date\(\s*\)/.test(code), 'use injected "now" (ISO string), not new Date()');
});
