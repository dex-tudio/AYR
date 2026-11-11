import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatMoney, positiveMoney } from '../ledger/contracts.ts';

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
