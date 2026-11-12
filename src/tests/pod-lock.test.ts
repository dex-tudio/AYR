import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const { load } = createRequire(import.meta.url)('js-yaml');
const lock = load(readFileSync('Podfile.lock', 'utf8'));

test('the native lock matches the Podfile and both workflows pin its CocoaPods version', () => {
  const podfile = readFileSync('Podfile', 'utf8').replaceAll('\r\n', '\n');
  assert.equal(lock['PODFILE CHECKSUM'], createHash('sha1').update(podfile).digest('hex'));
  assert.equal(lock.COCOAPODS, '1.17.0');
  for (const workflow of ['ci', 'testflight']) {
    const config = load(readFileSync(`.github/workflows/${workflow}.yml`, 'utf8'));
    const runs = Object.values(config.jobs).flatMap((job: any) => job.steps.map((step: any) => step.run ?? ''));
    assert.ok(runs.includes(`sudo gem install cocoapods -v ${lock.COCOAPODS} --no-document`), workflow);
  }
});

test('locked native sources stay inside local node_modules or generated build directories', () => {
  const sources: Array<Record<string, string>> = Object.values(lock['EXTERNAL SOURCES']);
  assert.ok(sources.length > 0);
  for (const source of sources) {
    const location = source[':path'] ?? source[':podspec'];
    assert.equal(typeof location, 'string');
    if (location.startsWith('node_modules/')) assert.equal(existsSync(location), true, location);
    else assert.match(location, /^build\/(?:rncore-facades|rndeps-facades|generated\/ios)\//);
  }
});
