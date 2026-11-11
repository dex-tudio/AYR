import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { PreviewLedger, summarizeMonth } from '../ledger/preview.ts';
import type { PreviewScenario } from '../ledger/preview.ts';
import { ledgerService as nativeService } from '../ledger/service.ios.ts';
import { assertMonthState, invalidMonthMessage, validMonthOffset } from '../ledger/contracts.ts';
import type { LedgerService, MonthViewState } from '../ledger/contracts.ts';
import { LedgerStore } from '../state/store.ts';
import { MonthStore } from '../state/monthStore.ts';

const dayOf = (month: MonthViewState, day: number) => month.days[day - 1];
const sum = (month: MonthViewState) => month.days.reduce((total, day) => total + BigInt(day.total ?? '0'), 0n);

test('the default fixture days add up to the month total of 286,400 with budget, remaining and comparison', async () => {
  const month = await new PreviewLedger().getMonth(0);
  assert.equal(month.title, '2026년 11월');
  assert.equal(month.days.length, 30);
  assert.equal(month.total, '286400');
  assert.equal(sum(month), 286400n);
  assert.equal(month.budget, '1500000');
  assert.equal(month.remaining, '1213600');
  assert.equal(month.overBudget, false);
  assert.deepEqual(month.comparison, { difference: '44400', direction: 'more' });
  assert.equal(dayOf(month, 11).total, '32400');
  assert.equal(dayOf(month, 11).key, '2026-11-11');
});

test('a recorded zero, a day without a record, and a day that has not come yet are three different things', async () => {
  const month = await new PreviewLedger().getMonth(0);
  assert.deepEqual([dayOf(month, 2).status, dayOf(month, 2).total], ['recorded', '0']);
  assert.deepEqual([dayOf(month, 12).status, dayOf(month, 12).total, dayOf(month, 12).phrase], ['future', null, null]);
  const july = await new PreviewLedger().getMonth(-4);
  assert.ok(july.days.every(day => day.status === 'noRecord' && day.total === null));
  assert.equal(july.total, '0');
  assert.equal(july.comparison, null);
  assert.ok(july.phraseCounts.every(item => item.days === 0));
  const september = await new PreviewLedger().getMonth(-2);
  assert.equal(dayOf(september, 15).status, 'noRecord');
  assert.equal(dayOf(september, 16).status, 'recorded');
});

test('days on the 50% and 100% boundaries get their own phrase and the counts add up', async () => {
  const month = await new PreviewLedger().getMonth(0);
  assert.equal(dayOf(month, 7).band, 'calm'); // 24,000 of 50,000
  assert.equal(dayOf(month, 6).band, 'caution'); // exactly 50%
  assert.equal(dayOf(month, 5).band, 'exceeded'); // exactly the budget
  assert.deepEqual(month.phraseCounts.map(item => [item.band, item.phrase, item.days]),
    [['calm', '아직은 여유 있네', 5], ['caution', '오늘 좀 쓰는데?', 5], ['exceeded', '님 부자임?', 1]]);
});

test('band boundaries follow Core for even and odd budgets', () => {
  const records = (budget: bigint, ...totals: bigint[]) => Object.fromEntries(totals.map((total, index) => [`2026-11-0${index + 1}`, { total, budget }]));
  const bands = (budget: bigint, ...totals: bigint[]) =>
    summarizeMonth({ offset: 0, month: '2026-11', today: '2026-11-09', records: records(budget, ...totals), budget: 1n }).days.slice(0, totals.length).map(day => day.band);
  assert.deepEqual(bands(50000n, 24999n, 25000n, 49999n, 50000n), ['calm', 'caution', 'caution', 'exceeded']);
  assert.deepEqual(bands(50001n, 25000n, 25001n, 50000n, 50001n), ['calm', 'caution', 'caution', 'exceeded']);
});

test('only offsets -11 to 0 are months; everything else is refused before any read', async () => {
  for (const good of [0, -1, -11]) assert.equal(validMonthOffset(good), true, String(good));
  for (const bad of [-12, 1, 0.5, -1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 2, '0', null, undefined]) {
    assert.equal(validMonthOffset(bad as number), false, String(bad));
    await assert.rejects(new PreviewLedger().getMonth(bad as number), /볼 수 있는 달/, String(bad));
    // The native service checks in JS first, so a bad number never reaches Expo's Int conversion.
    await assert.rejects(nativeService.getMonth(bad as number), /볼 수 있는 달/, String(bad));
  }
  await assert.rejects(nativeService.getMonth(0), /AYRNative/);
  const oldest = await new PreviewLedger().getMonth(-11);
  assert.equal(oldest.title, '2025년 12월');
  assert.deepEqual([oldest.canGoPrevious, oldest.canGoNext], [false, true]);
  const newest = await new PreviewLedger().getMonth(0);
  assert.deepEqual([newest.canGoPrevious, newest.canGoNext], [true, false]);
});

test('the comparison uses the same span, shortens to a short previous month, and is withheld without a basis', async () => {
  const all = (month: string, days: number, total: bigint) =>
    Object.fromEntries(Array.from({ length: days }, (_, index) => [`${month}-${String(index + 1).padStart(2, '0')}`, { total, budget: 50000n }]));
  const march = { offset: 0, month: '2026-03', today: '2026-03-31', budget: 1500000n };
  // March 31 days against February's 28 days: the span is the shorter one.
  const short = summarizeMonth({ ...march, records: { ...all('2026-02', 28, 1000n), ...all('2026-03', 31, 2000n) } });
  assert.deepEqual(short.comparison, { difference: String(2000n * 31n - 1000n * 28n), direction: 'more' });
  // One missing day in the previous month means there is no basis, not a zero.
  const gap = all('2026-02', 28, 1000n);
  delete gap['2026-02-14'];
  assert.equal(summarizeMonth({ ...march, records: { ...gap, ...all('2026-03', 31, 2000n) } }).comparison, null);
  // A day of this month inside the compared span without a record also withholds it.
  const hole = all('2026-03', 31, 2000n);
  delete hole['2026-03-05'];
  assert.equal(summarizeMonth({ ...march, records: { ...all('2026-02', 28, 1000n), ...hole } }).comparison, null);
  // The current month compares only up to today; equal totals are "same" with a zero difference.
  const partial = summarizeMonth({ offset: 0, month: '2026-03', today: '2026-03-10', budget: 1500000n,
    records: { ...all('2026-02', 28, 2000n), ...all('2026-03', 10, 2000n) } });
  assert.deepEqual(partial.comparison, { difference: '0', direction: 'same' });
  assert.deepEqual(summarizeMonth({ ...march, records: { ...all('2026-02', 28, 3000n), ...all('2026-03', 31, 100n) } }).comparison,
    { difference: String(3000n * 28n - 100n * 31n), direction: 'less' });
});

test('the default fixture has no comparison basis for October because September is only partly recorded', async () => {
  const october = await new PreviewLedger().getMonth(-1);
  assert.equal(october.comparison, null);
  assert.equal(october.total, String(sum(october)));
  assert.equal(october.days.length, 31);
});

test('changing the monthly budget changes this month only; past months keep theirs', async () => {
  const service = new PreviewLedger();
  const request = { identity: 'worker', dailyBudget: '40000', monthlyBudget: '2000000', sources: ['kbCheckSMS'], finishOnboarding: false };
  assert.equal((await service.saveSettings(request)).ok, true);
  assert.equal((await service.getMonth(0)).budget, '2000000');
  assert.equal((await service.getMonth(-1)).budget, '1500000');
  assert.equal((await service.saveSettings({ ...request, monthlyBudget: null })).ok, true);
  assert.equal((await service.getMonth(0)).budget, '1200000'); // daily budget x 30 days
  assert.equal((await service.getMonth(-1)).budget, '1500000');
  // Past days keep the budget of their day, so their phrases do not change either.
  assert.equal(dayOf(await service.getMonth(0), 7).band, 'calm'); // 24,000 against the old 50,000, not the new 40,000
});

test('over budget shows the excess, and the maximum scenario stays exact', async () => {
  const service = new PreviewLedger();
  await service.saveSettings({ identity: 'worker', dailyBudget: '50000', monthlyBudget: '200000', sources: ['kbCheckSMS'], finishOnboarding: false });
  const over = await service.getMonth(0);
  assert.deepEqual([over.remaining, over.overBudget], ['86400', true]);
  const max = await new PreviewLedger('maximum').getMonth(0);
  assert.equal(max.total, '25200470046051300');
  assert.deepEqual([max.remaining, max.overBudget], [String(25200470046051300n - 1500000n), true]);
  assert.equal(dayOf(max, 11).total, '25200470046051300');
});

test('adding and removing a spending changes today and the month total together', async () => {
  const service = new PreviewLedger();
  const ledger = new LedgerStore(service);
  await ledger.reload();
  const today = () => ledger.getState().snapshot!.ledger!.current;
  assert.equal(await ledger.addSpending('5100', today().day), true);
  const added = await service.getMonth(0);
  assert.equal(added.total, '291500');
  assert.equal(dayOf(added, 11).total, today().total);
  assert.equal(sum(added), 291500n);
  assert.equal(await ledger.removeSpending(0, today().expectedCurrent), true);
  const removed = await service.getMonth(0);
  assert.equal(removed.total, String(BigInt(added.total) - 5100n));
  assert.equal(dayOf(removed, 11).total, today().total);
  assert.equal(sum(removed), BigInt(removed.total));
});

test('after midnight yesterday keeps its total, the new day starts at zero, and the month total is unchanged', async () => {
  const service = new PreviewLedger();
  service.advanceDay();
  const month = await service.getMonth(0);
  assert.equal(dayOf(month, 11).total, '32400');
  assert.deepEqual([dayOf(month, 12).status, dayOf(month, 12).total], ['recorded', '0']);
  assert.equal(dayOf(month, 13).status, 'future');
  assert.equal(month.total, '286400');
});

test('a month that cannot be read is an error, not an empty month', async () => {
  for (const scenario of ['readFailure', 'corrupt'] as PreviewScenario[]) {
    await assert.rejects(new PreviewLedger(scenario).getMonth(0), /불러오지 못했어요|손상/, scenario);
  }
  // Before onboarding nothing is recorded yet, which is not the same as zero spending.
  const first = await new PreviewLedger('firstStart').getMonth(0);
  assert.ok(first.days.every(day => day.status !== 'recorded'));
});

test('a month response with a wrong amount or shape is refused as a whole', async () => {
  const good = await new PreviewLedger().getMonth(0);
  const cases: Array<(month: MonthViewState) => void> = [
    month => { month.total = '28,6400'; },
    month => { month.total = '286401'; }, // days no longer add up
    month => { month.budget = '-1'; },
    month => { month.remaining = '1'; },
    month => { month.overBudget = true; },
    month => { month.comparison = { difference: '0', direction: 'more' }; }, // a zero difference is "same"
    month => { month.comparison = { difference: '-5', direction: 'more' }; },
    month => { month.days[3].total = 'abc'; },
    month => { month.days[3].budget = null; },
    month => { month.days[11].total = '5'; month.days[11].budget = '5'; month.days[11].phrase = '아직은 여유 있네'; month.days[11].band = 'calm'; }, // future day with money
    month => { month.days[3].status = 'noRecord'; },
    month => { month.days[3].band = 'exceeded'; },
    month => { month.phraseCounts[0].days = 6; },
    month => { month.days.pop(); },
    month => { month.offset = -1; },
    month => { month.canGoNext = true; },
    month => { month.leadingBlanks = 7; },
    month => { month.weekdays = ['일']; },
    month => { (month as { days: unknown }).days = 'oops'; },
  ];
  assert.doesNotThrow(() => assertMonthState(structuredClone(good), 0));
  for (const [index, mutate] of cases.entries()) {
    const broken = structuredClone(good);
    mutate(broken);
    assert.throws(() => assertMonthState(broken, 0), RangeError, `case ${index}`);
  }
});

function deferredService() {
  const preview = new PreviewLedger();
  const pending: Array<{ offset: number; finish: () => void }> = [];
  const service = { getMonth: (offset: number) => new Promise<MonthViewState>((resolve, reject) => {
    pending.push({ offset, finish: () => preview.getMonth(offset).then(resolve, reject) });
  }) } as Pick<LedgerService, 'getMonth'>;
  return { service, pending };
}

test('a late result for an earlier month never overwrites the month that was chosen last', async () => {
  const { service, pending } = deferredService();
  const store = new MonthStore(service);
  store.select(-1);
  store.select(-2);
  assert.equal(store.getState().offset, -2);
  assert.equal(store.getState().month, null); // the old month is not shown under the new title
  pending[1].finish(); // -2 arrives first
  await new Promise(resolve => setTimeout(resolve, 0));
  pending[0].finish(); // -1 arrives late
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(store.getState().offset, -2);
  assert.equal(store.getState().month?.offset, -2);
  assert.equal(store.getState().month?.title, '2026년 9월');
  assert.equal(store.getState().loading, false);
});

test('a late failure of an earlier month does not replace the chosen month either', async () => {
  const { service, pending } = deferredService();
  const failing = new MonthStore({ getMonth: offset => offset === -1 ? Promise.reject(new Error('늦은 실패')) : service.getMonth(offset) });
  failing.select(-1);
  await new Promise(resolve => setTimeout(resolve, 0));
  failing.select(0);
  pending[0].finish();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(failing.getState().month?.offset, 0);
  assert.equal(failing.getState().error, null);
});

test('moving past the oldest or newest month does nothing', async () => {
  const store = new MonthStore(new PreviewLedger());
  assert.equal(store.select(1), false);
  assert.equal(store.select(-12), false);
  assert.equal(store.select(0.5), false);
  assert.equal(store.getState().offset, 0);
  assert.equal(store.select(-11), true);
  assert.equal(store.getState().offset, -11);
  assert.equal(store.select(-12), false);
});

test('a failed month read shows an error with no month, a wrong month from the service is refused, and a retry recovers', async () => {
  const preview = new PreviewLedger();
  let calls = 0;
  const store = new MonthStore({ getMonth: async offset => {
    calls += 1;
    if (calls === 1) throw new Error('기록을 불러오지 못했어요.');
    if (calls === 2) return { ...(await preview.getMonth(offset)), offset: -3 }; // not the month that was asked for
    return preview.getMonth(offset);
  } });
  await store.reload();
  assert.equal(store.getState().month, null);
  assert.match(store.getState().error ?? '', /불러오지 못했어요/);
  await store.reload();
  assert.equal(store.getState().month, null);
  assert.ok(store.getState().error);
  await store.reload();
  assert.equal(store.getState().error, null);
  assert.equal(store.getState().month?.total, '286400');
});

test('a failed refresh keeps the last good month of the same offset and reports the error', async () => {
  const preview = new PreviewLedger();
  let fail = false;
  const store = new MonthStore({ getMonth: offset => fail ? Promise.reject(new Error('읽기 실패')) : preview.getMonth(offset) });
  await store.reload();
  fail = true;
  await store.reload();
  assert.equal(store.getState().month?.total, '286400');
  assert.equal(store.getState().error, '읽기 실패');
});

test('the Swift bridge routes getMonth through AppModel and Core summary, and the preview is not used on the native path', () => {
  const module = readFileSync('iOS/App/AYRModule.swift', 'utf8');
  assert.match(module, /AsyncFunction\("getMonth"\)/);
  assert.match(module, /LedgerBridgeState\.month\(/);
  assert.match(module, /model\.reload\(\)/);
  const bridge = readFileSync('iOS/App/LedgerBridgeState.swift', 'utf8');
  assert.match(bridge, /static func month\(/);
  assert.match(bridge, /ledger\.summary\(for:/);
  assert.match(bridge, /monthOffsets = -11\.\.\.0/);
  assert.ok(bridge.includes(`static let invalidMonth = "${invalidMonthMessage}"`));
  assert.doesNotMatch(readFileSync('src/ledger/service.ios.ts', 'utf8'), /preview|summarizeMonth/);
  assert.doesNotMatch(readFileSync('src/state/monthStore.ts', 'utf8'), /preview|summarizeMonth/);
});
