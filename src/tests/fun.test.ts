import assert from 'node:assert/strict';
import { test } from 'node:test';
import { amountLabel, convertAmount, monthBadge, nextUnit, pokeLine } from '../fun.ts';
import { formatMoney } from '../ledger/contracts.ts';

test('convertAmount keeps won as the exact amount', () => {
  assert.deepEqual(convertAmount('12000', 'won'), { text: '12,000원', caption: '오늘 쓴 돈' });
});
test('convertAmount converts to gukbap with truncated tenths', () => {
  assert.equal(convertAmount('12000', 'gukbap').text, '국밥 1.2그릇');
  assert.equal(convertAmount('9999', 'gukbap').text, '국밥 0.9그릇');
  assert.equal(convertAmount('0', 'gukbap').text, '국밥 0.0그릇');
  assert.equal(convertAmount('25200470046051300', 'gukbap').text, '국밥 2,520,047,004,605.1그릇');
  assert.equal(convertAmount('12000', 'gukbap').caption, '국밥 환산 · 1그릇 10,000원 기준');
});
test('convertAmount converts to samgak by whole pieces', () => {
  assert.equal(convertAmount('12000', 'samgak').text, '삼김 8개');
  assert.equal(convertAmount('1499', 'samgak').text, '삼김 0개');
  assert.equal(convertAmount('12000', 'samgak').caption, '삼각김밥 환산 · 1개 1,500원 기준');
});
test('convertAmount converts to alba hours and minutes', () => {
  assert.equal(convertAmount('12000', 'alba').text, '알바 1시간 9분');
  assert.equal(convertAmount('10320', 'alba').text, '알바 1시간 0분');
  assert.equal(convertAmount('0', 'alba').text, '알바 0시간 0분');
  assert.equal(convertAmount('12000', 'alba').caption, '알바 환산 · 시급 10,320원 기준');
});
test('convertAmount rejects invalid money the same way formatMoney does', () => {
  for (const value of ['1.5', '-1', '', '1,000']) {
    assert.throws(() => convertAmount(value, 'gukbap'), RangeError, JSON.stringify(value));
    assert.throws(() => convertAmount(value, 'won'), RangeError, JSON.stringify(value));
  }
  assert.throws(() => formatMoney('1.5'), RangeError);
});
test('nextUnit cycles through the units', () => {
  assert.equal(nextUnit('alba'), 'won');
  assert.equal(nextUnit('won'), 'gukbap');
  assert.equal(nextUnit('gukbap'), 'samgak');
  assert.equal(nextUnit('samgak'), 'alba');
});
test('amountLabel adds the conversion only for non-won units', () => {
  assert.equal(amountLabel('12000', 'gukbap'), '오늘 쓴 돈 12,000원, 국밥 1.2그릇');
  assert.equal(amountLabel('12000', 'won'), '오늘 쓴 돈 12,000원');
});
test('pokeLine picks by count modulo 3 and treats bad counts as 0', () => {
  assert.equal(pokeLine('calm', 0), '배불러~ 오늘은 내가 쏜다');
  assert.equal(pokeLine('exceeded', 4), '나방이 이사 갔어');
  assert.equal(pokeLine('caution', -1), '지금 찌를 때야?');
  assert.equal(pokeLine('caution', 1.5), '지금 찌를 때야?');
  assert.equal(pokeLine('calm', 3), '배불러~ 오늘은 내가 쏜다');
});
test('monthBadge waits when no day is recorded', () => {
  assert.equal(monthBadge([{ band: 'calm', days: 0 }, { band: 'caution', days: 0 }, { band: 'exceeded', days: 0 }]), '칭호 대기 중');
});
test('monthBadge picks the band with the most days', () => {
  assert.equal(monthBadge([{ band: 'calm', days: 5 }, { band: 'caution', days: 2 }, { band: 'exceeded', days: 5 }]), '편의점 VIP');
  assert.equal(monthBadge([{ band: 'calm', days: 4 }, { band: 'caution', days: 1 }, { band: 'exceeded', days: 0 }]), '지갑 지킴이');
});
test('monthBadge breaks ties toward exceeded, then caution, then calm', () => {
  assert.equal(monthBadge([{ band: 'calm', days: 3 }, { band: 'caution', days: 3 }, { band: 'exceeded', days: 0 }]), '아슬아슬 줄타기꾼');
  assert.equal(monthBadge([{ band: 'calm', days: 3 }, { band: 'caution', days: 0 }, { band: 'exceeded', days: 3 }]), '편의점 VIP');
});
