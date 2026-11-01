import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayRange, israelToday } from '../src/dates.mjs';
import { reconcileDataset } from '../src/store.mjs';

// Banks report a transaction's day as Israeli local midnight, stored in UTC:
// 1 Oct 2026 (IDT, UTC+3) is "2026-09-30T21:00:00.000Z", and 1 Nov 2026 (IST,
// UTC+2, after the 25 Oct switch) is "2026-10-31T22:00:00.000Z". A plain
// string compare against "2026-10-01" drops the period's first day and leaks
// the next month's first day into it.
const OCT_1 = '2026-09-30T21:00:00.000Z';
const OCT_31 = '2026-10-30T22:00:00.000Z';
const NOV_1 = '2026-10-31T22:00:00.000Z';

test('dayRange turns Israeli calendar days into UTC bounds', () => {
  assert.deepEqual(dayRange('2026-10-01', '2026-10-31'), { lo: OCT_1, hi: NOV_1 });
  assert.deepEqual(dayRange(undefined, undefined), { lo: null, hi: null });
  assert.equal(dayRange('2026-10-01T05:00:00.000Z').lo, '2026-10-01T05:00:00.000Z'); // full instants pass through
});

test('a period counts its first local day and stops before the next month', () => {
  const r = reconcileDataset({
    accounts: [],
    transactions: [OCT_1, OCT_31, NOV_1].map(date => ({ provider: 'isracard', charged_amount: -10, date })),
    banks: [],
    cards: ['isracard'],
    from: '2026-10-01',
    to: '2026-10-31',
    now: '2026-11-02T00:00:00.000Z',
  });
  assert.equal(r.ledger.cardConsumption, -20); // 1 Oct and 31 Oct, not 1 Nov
});

test('israelToday follows the Israeli calendar, not UTC', () => {
  assert.equal(israelToday(new Date('2026-10-31T22:30:00.000Z')), '2026-11-01'); // 00:30 in Israel
});
