import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rupees, nextAction, timeAgo, minutesSince, isToday, STATUS_META } from '../src/lib/format.ts';
import { parseRupeesToPaise } from '../src/lib/money.ts';

test('rupees formats integer paise with Indian digit grouping', () => {
  assert.equal(rupees(0), '₹0');
  assert.equal(rupees(19900), '₹199');
  assert.equal(rupees(2050), '₹20.50');
  assert.equal(rupees(12345650), '₹1,23,456.50');
  assert.equal(rupees(100000), '₹1,000');
  assert.equal(rupees(-500), '-₹5');
});

test('parseRupeesToPaise accepts valid prices and rejects bad input', () => {
  assert.equal(parseRupeesToPaise('199'), 19900);
  assert.equal(parseRupeesToPaise(' 20.5 '), 2050);
  assert.equal(parseRupeesToPaise('0.99'), 99);
  assert.equal(parseRupeesToPaise('100000'), 10000000);
  for (const bad of ['', '0', '0.00', '-5', 'abc', '1.234', '100001', '1e3', '1,000', '.5']) {
    assert.equal(parseRupeesToPaise(bad), null, `should reject "${bad}"`);
  }
});

test('nextAction only offers merchant-permitted transitions', () => {
  assert.deepEqual(nextAction('PENDING'), { to: 'MERCHANT_ACCEPTED', label: 'Accept order' });
  assert.deepEqual(nextAction('MERCHANT_ACCEPTED')?.to, 'PREPARING');
  assert.deepEqual(nextAction('PREPARING')?.to, 'READY_FOR_PICKUP');
  for (const s of ['READY_FOR_PICKUP', 'RIDER_ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'REJECTED', 'CANCELLED'] as const) {
    assert.equal(nextAction(s), null, `${s} must have no merchant action`);
  }
});

test('every order status has display metadata', () => {
  for (const [status, meta] of Object.entries(STATUS_META)) {
    assert.ok(meta.label.length > 0 && meta.hint.length > 0, status);
  }
});

test('time helpers', () => {
  const now = Date.parse('2026-10-21T10:00:00Z');
  assert.equal(timeAgo('2026-10-21T09:59:40Z', now), 'Just now');
  assert.equal(timeAgo('2026-10-21T09:55:00Z', now), '5 min ago');
  assert.equal(timeAgo('2026-10-21T07:00:00Z', now), '3 hr ago');
  assert.equal(timeAgo('2026-10-19T10:00:00Z', now), '2 days ago');
  assert.equal(minutesSince('2026-10-21T09:50:00Z', now), 10);
  assert.equal(minutesSince('2026-10-21T10:30:00Z', now), 0);
  assert.equal(isToday(new Date(now).toISOString(), now), true);
  assert.equal(isToday('2026-10-19T10:00:00Z', now), false);
});
