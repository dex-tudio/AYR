import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { PreviewLedger } from '../ledger/preview.ts';
import { LedgerStore } from '../state/store.ts';
import type { AppSnapshot } from '../ledger/contracts.ts';

test('the product starts RN through the Expo scene lifecycle, without the previous UI', () => {
  const entry = readFileSync('iOS/App/AYRApp.swift', 'utf8');
  assert.match(entry, /class AYRApp: ExpoAppDelegate, ExpoReactNativeFactoryProvider/);
  assert.match(entry, /var window: UIWindow\?/);
  assert.match(entry, /ExpoReactNativeFactory\(delegate: delegate\)/);
  assert.match(readFileSync('iOS/App/SceneDelegate.swift', 'utf8'), /class SceneDelegate: ExpoAppSceneDelegate/);
  const info = readFileSync('iOS/metadata/App-Info.plist', 'utf8');
  assert.match(info, /<key>UISceneConfigurations<\/key>/);
  assert.match(info, /<string>\$\(PRODUCT_MODULE_NAME\)\.SceneDelegate<\/string>/);
  assert.doesNotMatch(entry, /#if DEBUG|--ayr-rn-preview|AppModel|HomeView|OnboardingView/);
  for (const name of ['HomeView', 'MonthlyView', 'OnboardingView', 'SettingsView', 'SettingsFields', 'TodaySpendingView', 'ConnectionViews', 'ReceptionStatusView']) {
    assert.equal(existsSync(`iOS/App/${name}.swift`), false, name);
  }
});

test('native calls fail clearly without AYRNative and never fall back to the web ledger', async () => {
  const { ledgerService } = await import('../ledger/service.ios.ts');
  await assert.rejects(ledgerService.getSnapshot(), /AYRNative/);
  await assert.rejects(ledgerService.refreshActivity(), /AYRNative/);
  const native = readFileSync('src/ledger/service.ios.ts', 'utf8');
  assert.doesNotMatch(native, /PreviewLedger|service\.web|preview\.ts/);
  assert.doesNotMatch(readFileSync('src/ledger/service.web.ts', 'utf8'), /expo-modules-core|service\.ios|requireNativeModule/);
});

test('a late activity refresh cannot replace a newer saved snapshot', async () => {
  const service = new PreviewLedger();
  const stale = await service.getSnapshot();
  let finish!: (snapshot: AppSnapshot) => void;
  service.refreshActivity = () => new Promise(resolve => { finish = resolve; });
  const store = new LedgerStore(service);
  await store.reload();
  const refresh = store.refreshActivity();
  assert.equal(store.getState().refreshing, true);
  assert.equal(await store.addSpending('1000', stale.ledger!.current.day), true);
  finish(stale);
  await refresh;
  assert.equal(store.getState().snapshot!.ledger!.current.total, '33400');
  assert.equal(store.getState().refreshing, false);
});

test('activity failure keeps spending and a retry clears only its read error', async () => {
  const service = new PreviewLedger();
  let fail = true;
  service.refreshActivity = async () => {
    if (fail) throw new Error('표시 상태를 불러오지 못했어요.');
    return { ...await service.getSnapshot(), activityNotice: '잠금화면 표시를 시작하지 못했어요.' };
  };
  const store = new LedgerStore(service);
  await store.reload();
  await store.refreshActivity();
  assert.equal(store.getState().snapshot!.ledger!.current.total, '32400');
  assert.equal(store.getState().readError, '표시 상태를 불러오지 못했어요.');
  fail = false;
  await store.refreshActivity();
  assert.equal(store.getState().readError, null);
  assert.equal(store.getState().snapshot!.activityNotice, '잠금화면 표시를 시작하지 못했어요.');
  assert.equal(store.getState().snapshot!.ledger!.current.total, '32400');
});

test('activity refresh is skipped during a write and the preview never claims a real activity', async () => {
  const service = new PreviewLedger();
  let calls = 0;
  service.refreshActivity = async () => { calls++; return service.getSnapshot(); };
  const store = new LedgerStore(service);
  await store.reload();
  const saving = store.addSpending('1000', store.getState().snapshot!.ledger!.current.day);
  await store.refreshActivity();
  await saving;
  assert.equal(calls, 0);
  const fake = await new PreviewLedger().refreshActivity();
  assert.equal(fake.activityEnabled, false);
  assert.equal(fake.activityNotice, null);
});
