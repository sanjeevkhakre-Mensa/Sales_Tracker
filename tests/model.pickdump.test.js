'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Model } = require('./helpers/loadModel');

// Hourly alerts trail in ONE Gmail thread (seen 14 Oct 2026: 16:32 … 21:32 IST).
const ist = (hhmm) => Date.parse('2026-10-14T' + hhmm + ':00+05:30');
const trail = [
  { id: 'm1632', time: ist('16:32'), hasCsv: true },
  { id: 'm1735', time: ist('17:35'), hasCsv: true },
  { id: 'm1832', time: ist('18:32'), hasCsv: true },
  { id: 'm1933', time: ist('19:33'), hasCsv: true },
  { id: 'm2031', time: ist('20:31'), hasCsv: true },
  { id: 'm2132', time: ist('21:32'), hasCsv: true }
];

test('picks the newest message in the trail, not the first', () => {
  assert.equal(Model.pickLatestDump(trail, {}), 'm2132');
});

test('order of messages in the thread does not matter', () => {
  const shuffled = [trail[3], trail[5], trail[0], trail[2], trail[4], trail[1]];
  assert.equal(Model.pickLatestDump(shuffled, {}), 'm2132');
});

test('already-processed newest dump → nothing to do (older ones are superseded)', () => {
  assert.equal(Model.pickLatestDump(trail, { m2132: true }), null);
});

test('a newer dump arriving after the last run is picked up', () => {
  const next = trail.concat([{ id: 'm2231', time: ist('22:31'), hasCsv: true }]);
  assert.equal(Model.pickLatestDump(next, { m2132: true }), 'm2231');
});

test('ignores newer messages without the CSV (e.g. a reply in the thread)', () => {
  const withReply = trail.concat([{ id: 'reply', time: ist('21:50'), hasCsv: false }]);
  assert.equal(Model.pickLatestDump(withReply, {}), 'm2132');
});

test('no CSV anywhere → null', () => {
  assert.equal(Model.pickLatestDump([{ id: 'x', time: 1, hasCsv: false }], {}), null);
  assert.equal(Model.pickLatestDump([], {}), null);
});
