import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { PreviewLedger, bridgeMessages, storeMessages } from '../ledger/preview.ts';
import type { PreviewScenario } from '../ledger/preview.ts';
import type { AppSnapshot, SettingsRequest } from '../ledger/contracts.ts';
import { assertSnapshotMoney, describeReception, draftFromSettings, identityDefault, settingsRequest, supportedTitles } from '../ledger/contracts.ts';
import { LedgerStore } from '../state/store.ts';
import { runSystemAction } from '../state/actions.ts';
import { watchActive } from '../state/polling.ts';

async function started(scenario: PreviewScenario = 'default') {
  const service = new PreviewLedger(scenario);
  const store = new LedgerStore(service);
  await store.reload();
  return { service, store };
}
const ledgerOf = (store: LedgerStore) => store.getState().snapshot!.ledger!;
const request = (patch: Partial<SettingsRequest> = {}): SettingsRequest => ({
  identity: 'student', dailyBudget: '20000', monthlyBudget: null, sources: ['kbCheckSMS'], finishOnboarding: false, ...patch,
});
const draft = (patch = {}) => ({ identity: 'worker', dailyBudget: '50000', customMonthly: false, monthlyBudget: '', sources: ['kbCheckSMS'], ...patch });

test('a new identity brings its own default budget, read from metadata', async () => {
  const { metadata } = await new PreviewLedger().getSnapshot();
  assert.equal(identityDefault(metadata, 'student'), '20000');
  assert.equal(identityDefault(metadata, 'jobSeeker'), '30000');
  assert.equal(identityDefault(metadata, 'worker'), '50000');
  assert.equal(identityDefault(metadata, 'nobody'), null);
});

test('settings drafts reject bad budgets, empty or unsupported sources, and unknown identities before any save', async () => {
  const { metadata } = await new PreviewLedger().getSnapshot();
  assert.deepEqual(settingsRequest(draft(), metadata, false),
    { identity: 'worker', dailyBudget: '50000', monthlyBudget: null, sources: ['kbCheckSMS'], finishOnboarding: false });
  for (const dailyBudget of ['', '0', '-1', '1.5', 'abc', ' 5', metadata.maximumMoney + '0', '25200470046051301']) {
    assert.equal(settingsRequest(draft({ dailyBudget }), metadata, false), null, `daily ${dailyBudget}`);
  }
  assert.equal(settingsRequest(draft({ dailyBudget: metadata.maximumMoney }), metadata, false)?.dailyBudget, metadata.maximumMoney);
  assert.equal(settingsRequest(draft({ sources: [] }), metadata, false), null, 'empty selection');
  assert.equal(settingsRequest(draft({ sources: ['tossNotification'] }), metadata, false), null, 'unsupported source');
  assert.equal(settingsRequest(draft({ sources: ['kbCheckSMS', 'tossNotification'] }), metadata, false), null);
  assert.equal(settingsRequest(draft({ identity: 'nobody' }), metadata, false), null);
  assert.equal(settingsRequest(draft({ customMonthly: true, monthlyBudget: '0' }), metadata, false), null);
  assert.equal(settingsRequest(draft({ customMonthly: true, monthlyBudget: '' }), metadata, false), null);
  assert.equal(settingsRequest(draft({ customMonthly: true, monthlyBudget: '1500000' }), metadata, true)?.monthlyBudget, '1500000');
  // An unchecked custom monthly budget is sent as null whatever text was typed.
  assert.equal(settingsRequest(draft({ customMonthly: false, monthlyBudget: 'abc' }), metadata, false)?.monthlyBudget, null);
});

test('the preview ledger refuses invalid settings without changing anything', async () => {
  const { service, store } = await started();
  const bad: Array<Partial<SettingsRequest>> = [
    { dailyBudget: '0' }, { dailyBudget: '1.5' }, { dailyBudget: '25200470046051301' }, { monthlyBudget: '0' },
    { identity: 'nobody' }, { sources: [] }, { sources: ['tossNotification'] }, { sources: ['kbCheckSMS', 'nope'] },
  ];
  for (const patch of bad) {
    const result = await service.saveSettings(request(patch));
    assert.equal(result.ok, false, JSON.stringify(patch));
    assert.ok(result.snapshot.error?.message);
    assert.equal(result.snapshot.ledger?.settings.identity, 'worker');
    assert.equal(result.snapshot.ledger?.settings.dailyBudget, '50000');
  }
  assert.equal(await store.saveSettings(request({ dailyBudget: '0' })), false);
  assert.ok(store.getState().failure);
  assert.equal(store.getState().failure?.source, 'settings');
  assert.equal(ledgerOf(store).settings.identity, 'worker');
});

test('saving a new identity and budget changes the day phrase basis and keeps today total', async () => {
  const { store } = await started();
  assert.equal(await store.saveSettings(request({ identity: 'student', dailyBudget: '20000', monthlyBudget: '600000' })), true);
  const ledger = ledgerOf(store);
  assert.equal(ledger.settings.identity, 'student');
  assert.equal(ledger.settings.monthlyBudget, '600000');
  assert.equal(ledger.current.budget, '20000');
  assert.equal(ledger.current.total, '32400');
  assert.equal(ledger.band, 'exceeded');
  assert.equal(ledger.phrase, '님 부자임?');
  assert.equal(store.getState().failure, null);
});

test('onboarding settings saves keep onboarding open until finish is requested', async () => {
  const { store } = await started('firstStart');
  assert.equal(ledgerOf(store).onboardingCompleted, false);
  assert.equal(await store.saveSettings(request()), true);
  assert.equal(ledgerOf(store).onboardingCompleted, false);
  assert.equal(await store.saveSettings(request({ finishOnboarding: true })), true);
  assert.equal(ledgerOf(store).onboardingCompleted, true);
});

test('a refused settings save changes nothing, shows the failure, and one retry saves', async () => {
  const { store } = await started('firstStartSaveFailureOnce');
  assert.equal(await store.saveSettings(request()), false);
  assert.equal(store.getState().failure?.source, 'settings');
  assert.equal(ledgerOf(store).settings.identity, 'worker', 'not saved');
  assert.equal(await store.saveSettings(request()), true);
  assert.equal(store.getState().failure, null);
  assert.equal(ledgerOf(store).settings.identity, 'student');
});

test('a second settings press while one is running is ignored', async () => {
  const { store } = await started();
  const [first, second] = await Promise.all([store.saveSettings(request()), store.saveSettings(request({ identity: 'jobSeeker', dailyBudget: '30000' }))]);
  assert.deepEqual([first, second], [true, false]);
  assert.equal(ledgerOf(store).settings.identity, 'student');
});

test('a test reception is shown as the last call but never added to spending', async () => {
  const { service, store } = await started('empty');
  assert.equal(ledgerOf(store).lastAttempt, null);
  service.receiveTest();
  await store.reload();
  const ledger = ledgerOf(store);
  assert.equal(ledger.lastAttempt?.status, 'test');
  assert.equal(ledger.lastAttempt?.message, '확인용 문자가 도착했어요. 지출에는 더하지 않았어요.');
  assert.equal(ledger.current.total, '0');
  assert.deepEqual(ledger.current.approvals, []);
});

test('finishing without any reception is not shown as a connection success', async () => {
  const { store } = await started('firstStart');
  assert.equal(await store.saveSettings(request({ finishOnboarding: true })), true);
  const ledger = ledgerOf(store);
  assert.equal(ledger.lastAttempt, null);
  assert.equal(ledger.lastReception, null);
  const view = describeReception(ledger);
  assert.equal(view.success, false);
  assert.equal(view.text, '아직 도착한 결제 문자가 없어요');
});

test('only success and test receptions count as connected', async () => {
  const base = (await new PreviewLedger('empty').getSnapshot()).ledger!;
  const attempt = (status: string, message: string) => ({ ...base, lastAttempt: { date: '2026-11-11T03:00:00.000Z', status, message } });
  assert.equal(describeReception(attempt('success', '오늘 쓴 돈에 더했어요')).success, true);
  assert.equal(describeReception(attempt('test', '확인용')).success, true);
  for (const status of ['ignored', 'overflow', 'notConfigured']) assert.equal(describeReception(attempt(status, '문구')).success, false, status);
  const withOnlyConnection = { ...base, lastReception: '2026-11-11T03:00:00.000Z' };
  assert.equal(describeReception(withOnlyConnection).success, false);
  assert.match(describeReception(withOnlyConnection).text, /^마지막 연결: 2026\. 11\. 11\. \d\d:\d\d/);
});

test('recovery is offered only for a damaged record, and only the preview reset scenario changes it', async () => {
  for (const scenario of ['default', 'empty', 'firstStart', 'readFailure'] as const) {
    const service = new PreviewLedger(scenario);
    const before = await service.getSnapshot();
    assert.notEqual(before.error?.canReset, true, scenario);
    const result = await service.resetRecords();
    assert.equal(result.ok, false, scenario);
    assert.equal(result.snapshot.error?.message, storeMessages.resetNotNeeded);
    assert.deepEqual((await service.getSnapshot()).ledger, before.ledger, `${scenario} unchanged`);
  }
});

test('a damaged record is read as a resettable error without a ledger', async () => {
  const state = await new PreviewLedger('corrupt').getSnapshot();
  assert.equal(state.ledger, null);
  assert.equal(state.error?.canReset, true);
  assert.equal(state.error?.message, storeMessages.unreadable);
});

test('reset success starts a fresh ledger that needs onboarding; reset failure keeps the damaged state', async () => {
  const { store } = await started('corruptResetFailureOnce');
  assert.equal(store.getState().snapshot?.error?.canReset, true);
  assert.equal(await store.resetRecords(), false);
  assert.equal(store.getState().failure?.source, 'reset');
  assert.equal(store.getState().failure?.message, storeMessages.backupFailed);
  assert.equal(store.getState().failure?.canReset, true, 'still recoverable after a failure');
  assert.equal(store.getState().snapshot?.ledger, null, 'nothing was replaced');
  assert.equal(await store.resetRecords(), true);
  assert.equal(store.getState().failure, null);
  assert.equal(store.getState().snapshot?.error, null);
  assert.equal(ledgerOf(store).onboardingCompleted, false);
});

test('a second reset press while one runs is ignored', async () => {
  const { store } = await started('corrupt');
  const [first, second] = await Promise.all([store.resetRecords(), store.resetRecords()]);
  assert.deepEqual([first, second], [true, false]);
});

test('settings and recovery money from the snapshot are checked as decimal text', async () => {
  const snapshot = await new PreviewLedger().getSnapshot();
  assert.equal(assertSnapshotMoney(snapshot), snapshot);
  const cases: Array<(s: AppSnapshot) => void> = [
    s => { s.ledger!.settings.dailyBudget = '5e4'; },
    s => { s.ledger!.settings.monthlyBudget = '-1'; },
    s => { s.metadata.identities[0].defaultBudget = '2 0000'; },
  ];
  for (const [index, mutate] of cases.entries()) {
    const broken = structuredClone(snapshot);
    mutate(broken);
    assert.throws(() => assertSnapshotMoney(broken), RangeError, `case ${index}`);
  }
});

test('the connection check timer ticks while active and is gone after leaving or backgrounding', () => {
  // Fake timers record every interval that is still running, so cleanup is counted rather than inferred.
  const running = new Map<number, () => void>();
  let nextId = 1;
  const timers = {
    setInterval: (handler: () => void) => { running.set(nextId, handler); return nextId++; },
    clearInterval: (id: number) => { running.delete(id); },
  };
  const tickAll = () => running.forEach(handler => handler());
  let ticks = 0;
  let state = 'active';
  const listeners = new Set<(next: string) => void>();
  const appState = {
    get currentState() { return state; },
    addEventListener: (_: 'change', listener: (next: string) => void) => { listeners.add(listener); return { remove: () => { listeners.delete(listener); } }; },
  };
  const stop = watchActive(appState, () => { ticks += 1; }, 3000, timers as never);
  assert.equal(running.size, 1, 'one timer while active');
  tickAll();
  assert.equal(ticks, 1);
  state = 'background'; listeners.forEach(listener => listener('background'));
  assert.equal(running.size, 0, 'timer cleared in the background');
  state = 'active'; listeners.forEach(listener => listener('active'));
  assert.equal(ticks, 2, 'one read on return');
  assert.equal(running.size, 1, 'timer restarted');
  listeners.forEach(listener => listener('active'));
  assert.equal(running.size, 1, 'no second timer for a repeated active event');
  stop();
  assert.equal(listeners.size, 0, 'listener removed');
  assert.equal(running.size, 0, 'timer cleared on leaving');
  const background = watchActive({ ...appState, currentState: 'background' }, () => {}, 3000, timers as never);
  assert.equal(running.size, 0, 'no timer when started in the background');
  background();
});

test('a failing clipboard, settings or URL action becomes a message instead of a success', async () => {
  assert.equal(await runSystemAction(async () => {}, '복사하지 못했어요.'), null);
  assert.equal(await runSystemAction(async () => { throw new Error('denied'); }, '복사하지 못했어요.'), '복사하지 못했어요.');
  assert.equal(await runSystemAction(() => { throw new Error('sync'); }, '단축어 앱을 열지 못했어요.'), '단축어 앱을 열지 못했어요.');
  assert.equal(await runSystemAction(async () => false, '단축어 앱을 열지 못했어요.'), '단축어 앱을 열지 못했어요.', 'a false result is a failure');
});

test('preview texts match the Swift sources and the bridge routes settings and recovery through AppModel', () => {
  const store = readFileSync('iOS/Shared/SpendingStore.swift', 'utf8');
  assert.ok(store.includes(`case .unreadable: "${storeMessages.unreadable}"`));
  assert.ok(store.includes(`case .resetNotNeeded: "${storeMessages.resetNotNeeded}"`));
  assert.ok(store.includes(`case .backupFailed: "${storeMessages.backupFailed}"`));
  const bridge = readFileSync('iOS/App/LedgerBridgeState.swift', 'utf8');
  assert.ok(bridge.includes(`"${bridgeMessages.invalidSettings}"`));
  assert.match(bridge, /static func settings\(/);
  const module = readFileSync('iOS/App/AYRModule.swift', 'utf8');
  assert.match(module, /AsyncFunction\("saveSettings"\)/);
  assert.match(module, /AsyncFunction\("resetRecords"\)/);
  assert.match(module, /model\.save\(settings:/);
  assert.match(module, /model\.resetRecords\(\)/);
  assert.match(module, /model\.canResetRecords/);
  const native = readFileSync('src/ledger/service.ios.ts', 'utf8');
  assert.match(native, /saveSettings/);
  assert.match(native, /resetRecords/);
});

test('stored sources that are not supported are dropped from the draft so the form can still be saved', async () => {
  const { metadata, ledger } = await (async () => { const state = await new PreviewLedger('mixedSources').getSnapshot(); return { metadata: state.metadata, ledger: state.ledger! }; })();
  assert.deepEqual(ledger.settings.sources, ['kbCheckSMS', 'tossNotification']);
  const draft = draftFromSettings(ledger.settings, metadata);
  assert.deepEqual(draft.sources, ['kbCheckSMS']);
  assert.notEqual(settingsRequest(draft, metadata, false), null, 'the filtered draft can be saved');
  assert.equal(settingsRequest({ ...draft, sources: ledger.settings.sources }, metadata, false), null, 'the raw stored list could not');
  // Nothing supported is stored: start from the supported sources instead of a form that can never be saved.
  const none = draftFromSettings({ ...ledger.settings, sources: ['tossNotification'] }, metadata);
  assert.deepEqual(none.sources, ['kbCheckSMS']);
  assert.equal(none.customMonthly, true);
  assert.equal(none.monthlyBudget, '1500000');
});

test('supported source titles come from metadata', async () => {
  const { metadata } = await new PreviewLedger().getSnapshot();
  assert.equal(supportedTitles(metadata), 'KB국민 체크카드 · 문자');
});

test('a healthy read ends a recovery failure, so the damaged screen does not outlive the damage', async () => {
  const damaged = new PreviewLedger('corruptResetFailureOnce');
  const healthy = new PreviewLedger();
  let mode: 'damaged' | 'healthy' = 'damaged';
  const store = new LedgerStore({
    getSnapshot: () => (mode === 'damaged' ? damaged : healthy).getSnapshot(),
    addSpending: (a, d) => healthy.addSpending(a, d), removeSpending: (i, e) => healthy.removeSpending(i, e),
    saveSettings: r => healthy.saveSettings(r), resetRecords: () => damaged.resetRecords(),
  });
  await store.reload();
  assert.equal(await store.resetRecords(), false);
  assert.equal(store.getState().failure?.canReset, true);
  await store.reload();
  assert.equal(store.getState().failure?.canReset, true, 'still damaged on the next read');
  mode = 'healthy';
  await store.reload();
  assert.equal(store.getState().failure, null);
  assert.equal(store.getState().snapshot?.error, null);
});

test('settings sources are read defensively in Swift and supported sources come from metadata in the preview', () => {
  assert.match(readFileSync('iOS/App/LedgerBridgeState.swift', 'utf8'), /request\["sources"\] as\? \[Any\]/);
  assert.doesNotMatch(readFileSync('src/ledger/preview.ts', 'utf8'), /raw === 'kbCheckSMS'/);
});
