import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { PreviewLedger } from '../ledger/preview.ts';
import { ledgerService as nativeService } from '../ledger/service.ios.ts';

test('preview returns fake exact money and metadata without native access', async () => {
  const state = await new PreviewLedger().getSnapshot();
  assert.equal(state.ledger?.current.total, '32400');
  assert.equal(state.ledger?.phrase, '오늘 좀 쓰는데?');
  assert.equal(state.ledger?.settings.identity, 'worker');
  assert.equal(typeof state.metadata.maximumMoney, 'string');
});
test('read failure does not turn into a successful zero', async () => {
  const service = new PreviewLedger('readFailure');
  const state = await service.getSnapshot();
  assert.equal(state.ledger, null);
  assert.ok(state.error?.message);
});
test('first start remains distinguishable from configured zero', async () => {
  assert.equal((await new PreviewLedger('firstStart').getSnapshot()).ledger?.onboardingCompleted, false);
  assert.equal((await new PreviewLedger('empty').getSnapshot()).ledger?.current.total, '0');
});
test('maximum scenario carries the full-width money string without precision loss', async () => {
  const state = await new PreviewLedger('maximum').getSnapshot();
  assert.equal(state.ledger?.current.total, state.metadata.maximumMoney);
  assert.equal(state.ledger?.current.total, '25200470046051300');
  assert.deepEqual(state.ledger?.current.approvals, ['25200470046051300']);
});
test('native module absence is an error, never preview fallback', async () => {
  await assert.rejects(nativeService.getSnapshot(), /AYRNative/);
});
test('native preparation and CI keep workspace, bundle, app-only pods connected', () => {
  const read = (path: string) => readFileSync(path, 'utf8');
  assert.match(read('scripts/prepare-ios.sh'), /xcodegen generate --spec/);
  assert.match(read('scripts/prepare-ios.sh'), /pod install --deployment/);
  assert.match(read('scripts/testflight-build.sh'), /bash scripts\/prepare-ios.sh "\$overlay_spec"/);
  assert.match(read('scripts/testflight-build.sh'), /-workspace AYR.xcworkspace/);
  assert.match(read('project.yml'), /export PROJECT_ROOT="\$PROJECT_DIR"/);
  assert.match(read('project.yml'), /BUNDLE_COMMAND=export:embed/);
  assert.match(read('project.yml'), /ENABLE_USER_SCRIPT_SANDBOXING: NO/);
  const pods = read('Podfile');
  assert.equal((pods.match(/target '/g) ?? []).length, 1);
  assert.match(pods, /target 'AYR'/);
  assert.match(pods, /providerName: 'AutolinkedExpoModulesProvider.swift'/);
  assert.match(read('.github/workflows/ci.yml'), /-workspace AYR.xcworkspace/);
  assert.match(read('.github/workflows/ci.yml'), /Podfile.lock/);
  assert.doesNotMatch(read('src/ledger/service.web.ts'), /expo-modules-core|service.ios|react-native/);
  assert.doesNotMatch(read('src/ledger/service.ios.ts'), /preview/);
});
