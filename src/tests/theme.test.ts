import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { test } from 'node:test';
import { moodBackground, palette } from '../themePalette.ts';

const keys = ['background', 'surface', 'ink', 'secondary', 'line', 'lime', 'limeInk', 'accent', 'calm', 'caution', 'exceeded',
  'moodCalm', 'moodCaution', 'moodExceeded', 'moodInk', 'shadow', 'wallet', 'critterLine', 'bill', 'tear', 'gold', 'blush', 'critterEye', 'moth', 'mothWing'];

// WCAG 2.x relative luminance and contrast ratio.
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test('palette has the same token keys in light and dark', () => {
  assert.deepEqual(Object.keys(palette(false)).sort(), [...keys].sort());
  assert.deepEqual(Object.keys(palette(true)).sort(), [...keys].sort());
});

test('text colors meet WCAG AA (4.5) in both modes', () => {
  for (const dark of [false, true]) {
    const p = palette(dark);
    const pairs: [string, string, string][] = [
      ['moodInk', p.moodInk, p.moodCalm], ['moodInk', p.moodInk, p.moodCaution], ['moodInk', p.moodInk, p.moodExceeded],
      ['ink/background', p.ink, p.background], ['ink/surface', p.ink, p.surface],
      ['limeInk/lime', p.limeInk, p.lime], ['secondary/surface', p.secondary, p.surface],
    ];
    for (const [name, fg, bg] of pairs) assert.ok(contrast(fg, bg) >= 4.5, `${dark ? 'dark' : 'light'} ${name} ${contrast(fg, bg).toFixed(2)}`);
  }
});

test('moodBackground maps each band to its mood color', () => {
  assert.equal(moodBackground('exceeded', false), '#FF6A4D');
  assert.equal(moodBackground('calm', true), '#123A22');
  assert.equal(moodBackground('caution', false), '#FFD43B');
});

test('iOS bundles the display font in both targets', () => {
  for (const plist of ['iOS/metadata/App-Info.plist', 'iOS/metadata/Widgets-Info.plist']) {
    assert.match(readFileSync(plist, 'utf8'), /<key>UIAppFonts<\/key>\s*<array>\s*<string>BlackHanSans-Regular\.ttf<\/string>/, plist);
  }
  assert.equal(statSync('iOS/Shared/Fonts/BlackHanSans-Regular.ttf').size, 998424);
  assert.ok(statSync('iOS/Shared/Fonts/OFL.txt').size > 0);
});
