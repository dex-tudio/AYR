import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getDefaultConfig } from 'expo/metro-config';
import config from '../../metro.config.js';

test('Metro keeps Expo exclusions and skips generated Swift build folders on either platform', () => {
  const defaults = getDefaultConfig(process.cwd()).resolver.blockList;
  const patterns = [config.resolver.blockList].flat();
  assert.deepEqual(patterns.slice(0, [defaults].flat().length).map(String), [defaults].flat().map(String));
  const blocked = (path: string) => patterns.some(pattern => pattern.test(path));
  for (const path of ['C:\\repo\\Core\\.build', 'C:\\repo\\Core\\.build\\debug', '/repo/Core/.build/debug']) {
    assert.equal(blocked(path), true, path);
  }
  for (const path of ['C:\\repo\\Core\\Sources\\AYRCore.swift', '/repo/src/ledger/service.web.ts', '/repo/Core/.builder/main.swift']) {
    assert.equal(blocked(path), false, path);
  }
});
