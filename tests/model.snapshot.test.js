'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Model } = require('./helpers/loadModel');
const CONFIG = require('../src/Config.js');

const fx = (f) => fs.readFileSync(path.join(__dirname, 'fixtures', f), 'utf8');
const dump = () => Model.parseCsv(fx('so_sku_listing.sample.csv'));
const customers = () => Model.indexCustomers(Model.parseCsv(fx('customers.sample.csv')), CONFIG);
const snap = () => Model.buildSnapshot(dump(), {
  config: CONFIG, customers: customers(), month: '2026-10',
  asOf: '2026-10-14T18:32:42+05:30', ingestedAt: '2026-10-14T18:40:00+05:30',
  source: { msgId: 'm1', file: 'SO SKU Listing.csv' }
});

test('parseCsv handles quoted commas and keeps column count', () => {
  const t = dump();
  assert.equal(t[1][12], 'Sample Peanut Butter, Crunchy 1kg');
  assert.ok(t.every((r) => r.length === t[0].length));
});

test('normalizeHeader treats underscores and spaces alike', () => {
  assert.equal(Model.normalizeHeader('  Total_Amount '), 'total amount');
  assert.equal(Model.normalizeHeader('AREAS SALES MANAGER/OWNER'), 'areas sales manager/owner');
});

test('mapColumns prefers exact match over contains (buyer vs buyer_code)', () => {
  const m = Model.mapColumns(['master_buyer', 'buyer', 'buyer_code'], { buyer: ['buyer'], buyerCode: ['buyer_code'] }, ['buyer']);
  assert.deepEqual(m.index, { buyer: 1, buyerCode: 2 });
  assert.deepEqual(m.missing, []);
});

test('mapColumns reports missing required columns', () => {
  const m = Model.mapColumns(['so_number'], CONFIG.COLUMNS, CONFIG.REQUIRED);
  assert.deepEqual(m.missing.sort(), ['amount', 'buyerCode', 'soDate', 'soStatus']);
});

test('parseAmount strips commas, rupee sign, blanks', () => {
  assert.equal(Model.parseAmount('1,244.02'), 1244.02);
  assert.equal(Model.parseAmount('₹ 45,265.69'), 45265.69);
  assert.equal(Model.parseAmount(''), 0);
  assert.equal(Model.parseAmount('n/a'), 0);
  assert.equal(Model.parseAmount(708), 708);
});

test('parseSoDate handles dump formats', () => {
  assert.equal(Model.parseSoDate('17-07-2026 18:36:25'), '2026-07-17');
  assert.equal(Model.parseSoDate('05/08/2026'), '2026-08-05');
  assert.equal(Model.parseSoDate('2026-10-03T10:00:00'), '2026-10-03');
  assert.equal(Model.parseSoDate('July 17, 2026'), '2026-07-17');
  assert.equal(Model.parseSoDate('32-01-2026'), null);
  assert.equal(Model.parseSoDate(''), null);
});

test('indexCustomers: first code wins, non-person owners → Unassigned, title-cased', () => {
  const c = customers();
  assert.equal(c.BY900001.owner, 'Ravi Kumar');
  assert.equal(c.BY900001.rsm, 'Anil Mehta');
  assert.equal(c.BY900003.owner, 'Unassigned');
  assert.equal(Object.keys(c).length, 3);
});

test('buildSnapshot keeps only offline SOs of the running month', () => {
  const s = snap();
  const ids = s.sos.map((x) => x.so).sort();
  assert.deepEqual(ids, ['OFF-001', 'OFF-002', 'OFF-003', 'OFF-004', 'OFF-005', 'OFF-006', 'OFF-007', 'OFF-008']);
  assert.equal(s.stats.rowsIn, 14);
  assert.equal(s.stats.rowsKept, 11);
  assert.equal(s.stats.droppedType, 2);
  assert.equal(s.stats.droppedMonth, 1);
  assert.equal(s.stats.capWarning, false);
});

test('buildSnapshot groups lines per SO and sums total amount', () => {
  const s = snap();
  const o3 = s.sos.find((x) => x.so === 'OFF-003');
  assert.equal(o3.lines.length, 3);
  assert.equal(o3.amt, 17464);
  assert.equal(o3.st, 'DISPATCHED');
  assert.equal(o3.d, '2026-10-01');
  assert.deepEqual(o3.lines[2], ['SKU-103', 'Sample Muesli 750g', 10, 8, 2, 2124]);
  const o1 = s.sos.find((x) => x.so === 'OFF-001');
  assert.equal(o1.amt, 3540.5);
});

test('buildSnapshot joins owner from customer master; unknown buyer → Unmapped', () => {
  const s = snap();
  assert.equal(s.sos.find((x) => x.so === 'OFF-001').o, 'Ravi Kumar');
  assert.equal(s.sos.find((x) => x.so === 'OFF-004').o, 'Unassigned');
  assert.equal(s.sos.find((x) => x.so === 'OFF-007').o, 'Unmapped');
  assert.deepEqual(s.unmappedBuyers, ['BY900099']);
});

test('buildSnapshot flags unknown statuses and keeps them as OTHER bucket', () => {
  const s = snap();
  assert.deepEqual(s.unknownStatuses, ['ON_HOLD']);
  assert.deepEqual(s.statuses.find((x) => x.key === 'ON_HOLD'), { key: 'ON_HOLD', label: 'On Hold', bucket: 'OTHER' });
  assert.deepEqual(s.exclude, ['CANCELLED']);
});

test('buildSnapshot total of kept lines equals sum of SO amounts', () => {
  const s = snap();
  const bySo = s.sos.reduce((a, x) => a + x.amt, 0);
  const byLine = s.sos.reduce((a, x) => a + x.lines.reduce((b, l) => b + l[5], 0), 0);
  assert.equal(Math.round(bySo * 100), Math.round(byLine * 100));
  // 3540.5 + 5900 + 17464 + 4720 + 1770 + 2360 + 708 + 1062
  assert.equal(Math.round(bySo * 100) / 100, 37524.5);
});

test('buildSnapshot throws on missing required columns', () => {
  assert.throws(() => Model.buildSnapshot([['so_number', 'foo'], ['X', '1']], { config: CONFIG, month: '2026-10' }), /MISSING_COLUMNS/);
});

test('buildSnapshot flags possible Metabase row cap', () => {
  const t = dump();
  const big = [t[0]];
  for (let i = 0; i < 2000; i++) big.push(t[1]);
  const s = Model.buildSnapshot(big, { config: CONFIG, customers: {}, month: '2026-10' });
  assert.equal(s.stats.capWarning, true);
});

test('Config: every report status has a bucket and excluded statuses exist', () => {
  const keys = CONFIG.STATUSES.map((s) => s.key);
  CONFIG.EXCLUDE_FROM_REPORT.forEach((k) => assert.ok(keys.includes(k)));
  CONFIG.STATUSES.forEach((s) => assert.ok(['BILLED', 'OPEN', 'PENDING', 'CANCELLED'].includes(s.bucket)));
});
