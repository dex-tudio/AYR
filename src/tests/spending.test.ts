import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { PreviewLedger } from '../ledger/preview.ts';
import type { PreviewScenario } from '../ledger/preview.ts';
import { messages } from '../ledger/preview.ts';
import type { AppSnapshot, LedgerService, MutationResult } from '../ledger/contracts.ts';
import { assertSnapshotMoney } from '../ledger/contracts.ts';
import { LedgerStore } from '../state/store.ts';

async function started(scenario: PreviewScenario = 'default') {
  const service = new PreviewLedger(scenario);
  const store = new LedgerStore(service);
  await store.reload();
  return { service, store };
}
const current = (store: LedgerStore) => store.getState().snapshot!.ledger!.current;

test('fake fixture sums to 32400 and adding 5100 gives 37500', async () => {
  const { store } = await started();
  assert.deepEqual(current(store).approvals, ['5100', '8700', '18600']);
  assert.equal(current(store).total, '32400');
  assert.equal(await store.addSpending('5100', current(store).day), true);
  assert.equal(current(store).total, '37500');
  assert.equal(store.getState().snapshot!.ledger!.phrase, '오늘 좀 쓰는데?');
  assert.equal(store.getState().failure, null);
});

test('adding validates amounts at the boundary and keeps exact digits', async () => {
  const { store } = await started();
  const day = current(store).day;
  for (const bad of ['0', '-5', '1.5', ' 5', '', '25200470046051301']) {
    assert.equal(await store.addSpending(bad, day), false, JSON.stringify(bad));
    assert.equal(store.getState().failure?.message, messages.invalidAmount);
    assert.equal(current(store).total, '32400');
  }
  // maximumMoney - 32400 is the largest amount that still fits; one more overflows.
  assert.equal(await store.addSpending('25200470046018901', day), false);
  assert.equal(store.getState().failure?.message, messages.amountOverflow);
  assert.equal(await store.addSpending('25200470046018900', day), true);
  assert.equal(current(store).total, '25200470046051300');
});

test('removing one of two equal amounts removes only the selected entry', async () => {
  const { store } = await started();
  await store.addSpending('5100', current(store).day);
  const before = current(store);
  assert.deepEqual(before.approvals, ['5100', '8700', '18600', '5100']);
  assert.equal(await store.removeSpending(3, before.expectedCurrent), true);
  assert.deepEqual(current(store).approvals, ['5100', '8700', '18600']);
  await store.addSpending('5100', current(store).day);
  assert.equal(await store.removeSpending(0, current(store).expectedCurrent), true);
  assert.deepEqual(current(store).approvals, ['8700', '18600', '5100']);
});

test('carried total is never a removal target and survives removing the last new entry', async () => {
  const { store } = await started('carried');
  const before = current(store);
  assert.equal(before.carriedTotal, '12000');
  assert.deepEqual(before.approvals, ['3000']);
  assert.equal(before.total, '15000');
  // Index 1 would be the carried amount if it were wrongly listed.
  assert.equal(await store.removeSpending(1, before.expectedCurrent), false);
  assert.equal(store.getState().failure?.message, messages.spendingChanged);
  assert.equal(current(store).total, '15000');
  assert.equal(await store.removeSpending(0, current(store).expectedCurrent), true);
  assert.deepEqual(current(store).approvals, []);
  assert.equal(current(store).carriedTotal, '12000');
  assert.equal(current(store).total, '12000');
});

test('removing the last entry of an empty carried-free day leaves zero', async () => {
  const { store } = await started('empty');
  await store.addSpending('700', current(store).day);
  assert.equal(await store.removeSpending(0, current(store).expectedCurrent), true);
  assert.equal(current(store).total, '0');
});

test('requests made for an earlier day are rejected, nothing changes, retry after refresh works', async () => {
  const { service, store } = await started();
  const oldDay = current(store).day;
  service.advanceDay();
  assert.equal(await store.addSpending('1000', oldDay), false);
  assert.equal(store.getState().failure?.message, messages.dayChanged);
  assert.equal(current(store).day, '2026-11-12');
  assert.equal(current(store).total, '0');
  // Reading again must not erase the failure state.
  await store.reload();
  assert.equal(store.getState().failure?.message, messages.dayChanged);
  assert.equal(await store.addSpending('1000', current(store).day), true);
  assert.equal(store.getState().failure, null);
  assert.equal(current(store).total, '1000');
});

test('a removal confirmed after the day changed is rejected', async () => {
  const { service, store } = await started();
  const stale = current(store);
  service.advanceDay();
  assert.equal(await store.removeSpending(0, stale.expectedCurrent), false);
  assert.equal(store.getState().failure?.message, messages.dayChanged);
});

test('a reception during removal confirmation rejects the stale selection', async () => {
  const { service, store } = await started();
  const stale = current(store);
  service.receive('1200');
  assert.equal(await store.removeSpending(0, stale.expectedCurrent), false);
  assert.equal(store.getState().failure?.message, messages.spendingChanged);
  assert.deepEqual(current(store).approvals, ['5100', '8700', '18600', '1200']);
  assert.equal(await store.removeSpending(0, current(store).expectedCurrent), true);
  assert.deepEqual(current(store).approvals, ['8700', '18600', '1200']);
});

test('pressing twice applies once', async () => {
  const { store } = await started();
  const day = current(store).day;
  const first = store.addSpending('1000', day);
  const second = store.addSpending('1000', day);
  assert.deepEqual(await Promise.all([first, second]), [true, false]);
  assert.deepEqual(current(store).approvals, ['5100', '8700', '18600', '1000']);
  const expected = current(store).expectedCurrent;
  const removes = [store.removeSpending(3, expected), store.removeSpending(3, expected)];
  assert.deepEqual(await Promise.all(removes), [true, false]);
  assert.deepEqual(current(store).approvals, ['5100', '8700', '18600']);
});

test('a failed save keeps its failure through reads and one retry saves exactly once', async () => {
  const { store } = await started('saveFailureOnce');
  const day = current(store).day;
  assert.equal(await store.addSpending('1000', day), false);
  assert.ok(store.getState().failure?.message);
  assert.equal(current(store).total, '32400');
  await store.reload();
  assert.ok(store.getState().failure, 'a read must not clear the save failure');
  assert.equal(await store.addSpending('1000', day), true);
  assert.equal(store.getState().failure, null);
  assert.deepEqual(current(store).approvals, ['5100', '8700', '18600', '1000']);
});

test('first start rejects changes with the Core message', async () => {
  const { store } = await started('firstStart');
  assert.equal(await store.addSpending('1000', current(store).day), false);
  assert.equal(store.getState().failure?.message, messages.notConfigured);
});

test('a late read never overwrites a newer mutation result', async () => {
  const preview = new PreviewLedger();
  let release!: (snapshot: AppSnapshot) => void;
  let slow = true;
  const service: LedgerService = {
    getSnapshot: () => {
      if (!slow) return preview.getSnapshot();
      slow = false;
      return new Promise<AppSnapshot>(resolve => { release = resolve; });
    },
    addSpending: (amount, day) => preview.addSpending(amount, day),
    removeSpending: (index, expected) => preview.removeSpending(index, expected),
  };
  const store = new LedgerStore(service);
  const stale = await preview.getSnapshot();
  const read = store.reload();
  assert.equal(store.getState().refreshing, true);
  assert.equal(await store.addSpending('1000', stale.ledger!.current.day), true);
  assert.equal(current(store).total, '33400');
  release(stale);
  await read;
  assert.equal(current(store).total, '33400', 'the stale read must be dropped');
  assert.equal(store.getState().refreshing, false);
  // A read begun after the mutation is applied normally.
  await store.reload();
  assert.equal(current(store).total, '33400');
});

test('reads do not start while a mutation is running', async () => {
  const preview = new PreviewLedger();
  let reads = 0;
  const service: LedgerService = {
    getSnapshot: () => { reads++; return preview.getSnapshot(); },
    addSpending: (amount, day) => preview.addSpending(amount, day),
    removeSpending: (index, expected) => preview.removeSpending(index, expected),
  };
  const store = new LedgerStore(service);
  await store.reload();
  const saving = store.addSpending('1000', current(store).day);
  await store.reload();
  await saving;
  assert.equal(reads, 1);
});

test('an unknown mutation outcome is reported, re-read, and never retried automatically', async () => {
  const preview = new PreviewLedger();
  let adds = 0;
  const service: LedgerService = {
    getSnapshot: () => preview.getSnapshot(),
    addSpending: async (amount, day) => { adds++; await preview.addSpending(amount, day); throw new Error('bridge failed'); },
    removeSpending: (index, expected) => preview.removeSpending(index, expected),
  };
  const store = new LedgerStore(service);
  await store.reload();
  assert.equal(await store.addSpending('1000', current(store).day), false);
  assert.equal(adds, 1);
  assert.match(store.getState().failure!.message, /확인/);
  assert.equal(current(store).total, '33400', 'the re-read shows what was actually saved');
  assert.equal(store.getState().mutating, false);
});

test('a mutation result with a malformed amount is rejected as a whole', async () => {
  const preview = new PreviewLedger();
  const service: LedgerService = {
    getSnapshot: () => preview.getSnapshot(),
    addSpending: async (): Promise<MutationResult> => {
      const snapshot = await preview.getSnapshot();
      snapshot.ledger!.current.approvals = ['5100', '1e3'];
      return { ok: true, snapshot };
    },
    removeSpending: (index, expected) => preview.removeSpending(index, expected),
  };
  const store = new LedgerStore(service);
  await store.reload();
  assert.equal(await store.addSpending('1000', current(store).day), false);
  assert.deepEqual(current(store).approvals, ['5100', '8700', '18600']);
});

test('assertSnapshotMoney checks every amount the spending screens show', async () => {
  const snapshot = await new PreviewLedger('carried').getSnapshot();
  assert.equal(assertSnapshotMoney(snapshot), snapshot);
  const cases: Array<(s: AppSnapshot) => void> = [
    s => { s.ledger!.current.carriedTotal = '-1'; },
    s => { s.ledger!.current.approvals[0] = '3 000'; },
    s => { s.ledger!.current.total = '14999'; },
    s => { s.metadata.maximumMoney = ''; },
    s => { (s.ledger!.current as { approvals: unknown }).approvals = 'oops'; },
    s => { (s.ledger!.current as { expectedCurrent: unknown }).expectedCurrent = 3; },
  ];
  for (const [index, mutate] of cases.entries()) {
    const broken = structuredClone(snapshot);
    mutate(broken);
    assert.throws(() => assertSnapshotMoney(broken), RangeError, `case ${index}`);
  }
});

test('preview error text and phrases match Core', () => {
  const source = readFileSync('Core/Sources/AYRCore/SpendingLedger.swift', 'utf8');
  for (const [name, text] of Object.entries(messages)) {
    assert.ok(source.includes(`case .${name}: "${text}"`), name);
  }
  const phrases = readFileSync('Core/Sources/AYRCore/AYRCore.swift', 'utf8');
  for (const text of ['아직은 여유 있네', '오늘 좀 쓰는데?', '님 부자임?']) assert.ok(phrases.includes(`"${text}"`), text);
});

test('Swift bridge decodes removal input safely and routes mutations through AppModel', () => {
  const bridge = readFileSync('iOS/App/LedgerBridgeState.swift', 'utf8');
  assert.match(bridge, /static func removal\(index: Int, expectedCurrent: String\)/);
  assert.match(bridge, /JSONDecoder\(\)\.decode\(DailySpending\.self/);
  const module = readFileSync('iOS/App/AYRModule.swift', 'utf8');
  assert.match(module, /AsyncFunction\("addSpending"\)/);
  assert.match(module, /AsyncFunction\("removeSpending"\)/);
  assert.match(module, /model\.addSpending\(/);
  assert.match(module, /model\.removeSpending\(at:/);
  assert.doesNotMatch(module, /DailySpending\(day:/);
});
