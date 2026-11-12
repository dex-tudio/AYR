import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { nativeMessage, nativeFailure } from '../ledger/nativeError.ts';

const wrapped = (name: string, cause: string) => new Error(`Calling the '${name}' function has failed\n→ Caused by: ${cause}`);

test('an Expo-wrapped native error shows only the last Korean user message', () => {
  assert.equal(nativeMessage(wrapped('getMonth', '기록을 불러오지 못했어요.')), '기록을 불러오지 못했어요.');
  assert.equal(nativeMessage(new Error("Calling the 'getMonth' function has failed\n→ Caused by: A\n→ Caused by: 저장된 기록이 손상됐어요.")), '저장된 기록이 손상됐어요.');
});

test('a native error without a Korean user message falls back to a fixed Korean text', () => {
  const fallback = nativeFailure;
  assert.equal(nativeMessage(new Error("Calling the 'saveSettings' function has failed")), fallback);
  assert.equal(nativeMessage(wrapped('getSnapshot', 'The operation couldn’t be completed. (NSCocoaErrorDomain error 260.)')), fallback);
  assert.equal(nativeMessage(new Error('')), fallback);
  assert.equal(nativeMessage('boom'), fallback);
  assert.equal(nativeMessage(undefined), fallback);
  assert.match(fallback, /[가-힣]/);
});

test('a plain Korean message passes through unchanged', () => {
  assert.equal(nativeMessage(new Error('볼 수 있는 달이 아니에요.')), '볼 수 있는 달이 아니에요.');
});

test('every native call of the iOS service goes through the message cleanup', () => {
  const source = readFileSync('src/ledger/service.ios.ts', 'utf8');
  for (const name of ['getSnapshot', 'getMonth', 'addSpending', 'removeSpending', 'saveSettings', 'resetRecords']) {
    assert.ok(source.includes(`call(module => module.${name}(`), name);
  }
  assert.doesNotMatch(source, /\(await native\(\)\)\./);
});

test('a month read that fails after a good read is an error in Swift, not a stale month', () => {
  const module = readFileSync('iOS/App/AYRModule.swift', 'utf8');
  const month = module.slice(module.indexOf('private func getMonth'), module.indexOf('private func snapshot('));
  assert.match(month, /model\.reload\(\)[\s\S]*if let message = model\.error[\s\S]*throw Exception[\s\S]*guard let ledger = model\.ledger/);
});
