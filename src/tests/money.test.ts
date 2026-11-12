import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertSnapshotMoney, formatMoney, positiveMoney } from '../ledger/contracts.ts';

test('money stays decimal text above the JS safe integer boundary', () => {
  assert.equal(formatMoney('9007199254740993'), '9,007,199,254,740,993원');
  assert.equal(positiveMoney('9007199254740993', '25200470046051300'), '9007199254740993');
  assert.equal(positiveMoney('25200470046051300', '25200470046051300'), '25200470046051300');
});
test('positive money rejects invalid and out-of-range input', () => {
  for (const value of ['0', '-1', '1.2', ' ', ' 1', '1 ', '', '1e3', '25200470046051301']) {
    assert.equal(positiveMoney(value, '25200470046051300'), null, value);
  }
});
test('formatMoney groups thousands without Intl and keeps the maximum exact', () => {
  assert.equal(formatMoney('0'), '0원');
  assert.equal(formatMoney('999'), '999원');
  assert.equal(formatMoney('1000'), '1,000원');
  assert.equal(formatMoney('25200470046051300'), '25,200,470,046,051,300원');
});
test('formatMoney rejects empty and non-decimal text instead of showing zero', () => {
  for (const value of ['', ' ', '-1', '1.5', '1e3', 'abc', '1,000', ' 1']) {
    assert.throws(() => formatMoney(value), RangeError, JSON.stringify(value));
  }
});
test('snapshot with a non-decimal amount is rejected as a whole', async () => {
  const { PreviewLedger } = await import('../ledger/preview.ts');
  const snapshot = await new PreviewLedger().getSnapshot();
  assert.equal(assertSnapshotMoney(snapshot), snapshot);
  const broken = structuredClone(snapshot);
  broken.ledger!.current.total = '';
  assert.throws(() => assertSnapshotMoney(broken), RangeError);
});
