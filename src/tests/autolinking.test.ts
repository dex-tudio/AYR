import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, mkdtempSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const root = process.cwd();
// Exercise the actual literal command in Podfile, resolving Ruby's __dir__ to the Podfile directory.
const body = readFileSync('Podfile', 'utf8').match(/config = use_native_modules!\(\[([\s\S]*?)\]\)/)![1];
const [command, ...args] = [...body.matchAll(/'([^']*)'|"([^"]*)"|(__dir__)/g)].map(match => match[3] ? root : match[1] ?? match[2]);
assert.equal(command, 'node');
const config = JSON.parse(execFileSync(process.execPath, args, { cwd: root, encoding: 'utf8' }));
const iosRoot = config.project.ios.sourceDir;

test('autolinking uses the root Podfile directory as the iOS project root', () => {
  assert.equal(iosRoot, root);
});

test('React Native path from autolinking resolves from the actual root Podfile', () => {
  const relativeRN = path.relative(iosRoot, config.reactNativePath);
  assert.equal(path.resolve(root, relativeRN), config.reactNativePath);
  assert.equal(existsSync(path.join(root, relativeRN, 'package.json')), true);
});

test('every autolinked iOS pod path resolves from the actual root Podfile', () => {
  const pods = Object.values(config.dependencies).map((dependency: any) => dependency.platforms.ios?.podspecPath).filter(Boolean);
  assert.ok(pods.length > 0);
  for (const podspec of pods) {
    const relativePod = path.relative(iosRoot, path.dirname(podspec));
    assert.equal(path.resolve(root, relativePod), path.dirname(podspec), podspec);
    assert.equal(existsSync(path.join(root, relativePod, path.basename(podspec))), true, podspec);
  }
});

test('Expo Constants generates app config from the root-based Pods project', () => {
  const setting = readFileSync('Podfile', 'utf8').match(/build_settings\['PROJECT_ROOT'\]\s*=\s*'([^']+)'/)?.[1] ?? '$(SRCROOT)/../..';
  const projectRoot = path.resolve(setting.replace('$(SRCROOT)', path.join(root, 'Pods')));
  assert.equal(projectRoot, root);
  const destination = mkdtempSync(path.join(tmpdir(), 'ayr-app-config-'));
  const output = path.join(destination, 'app.config');
  try {
    execFileSync(process.execPath, ['node_modules/expo-constants/scripts/getAppConfig.js', projectRoot, destination, 'ios', 'false', 'production'], { cwd: root, stdio: 'pipe' });
    assert.equal(JSON.parse(readFileSync(output, 'utf8')).ios.bundleIdentifier, 'com.codemaker-kim.ayr');
  } finally {
    if (existsSync(output)) unlinkSync(output);
    rmdirSync(destination);
  }
});
