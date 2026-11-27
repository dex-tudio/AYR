import type { Band } from './ledger/contracts.ts';

// Kept free of react-native so tests can import it directly. theme.ts re-exports it.
const colors = {
  background: ['#EDE6FF', '#17151F'], surface: ['#FFFFFF', '#23202E'], ink: ['#111111', '#F4F2FA'], secondary: ['#4A4658', '#B9B4C8'],
  line: ['#111111', '#F4F2FA'], lime: ['#FFD43B', '#FFD43B'], limeInk: ['#111111', '#111111'], accent: ['#6C3BFF', '#B49BFF'],
  calm: ['#1E7A3A', '#7FE39A'], caution: ['#8A5A00', '#FFD43B'], exceeded: ['#C2321F', '#FF8A73'],
  moodCalm: ['#BDF2C9', '#123A22'], moodCaution: ['#FFD43B', '#4A3A00'], moodExceeded: ['#FF6A4D', '#4A150D'], moodInk: ['#111111', '#F5F5F0'],
  shadow: ['#111111', '#000000'], wallet: ['#6C3BFF', '#6C3BFF'], critterLine: ['#111111', '#111111'], bill: ['#5AD678', '#5AD678'],
  tear: ['#4FB6FF', '#4FB6FF'], gold: ['#FFC400', '#FFC400'], blush: ['#FF8FB1', '#FF8FB1'],
  critterEye: ['#FFFFFF', '#FFFFFF'], moth: ['#C9C6D3', '#C9C6D3'], mothWing: ['#8E8A9C', '#8E8A9C'],
} as const;

export function palette(dark: boolean) {
  const i = dark ? 1 : 0;
  return Object.fromEntries(Object.entries(colors).map(([key, pair]) => [key, pair[i]])) as { [K in keyof typeof colors]: string };
}
export function moodBackground(band: Band, dark: boolean) {
  const p = palette(dark);
  return band === 'calm' ? p.moodCalm : band === 'caution' ? p.moodCaution : p.moodExceeded;
}
