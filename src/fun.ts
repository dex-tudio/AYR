import { formatMoney, type Band, type Money } from './ledger/contracts.ts';

export type AmountUnit = 'won' | 'gukbap' | 'samgak' | 'alba';
export const amountUnits: AmountUnit[] = ['won', 'gukbap', 'samgak', 'alba'];
export function nextUnit(unit: AmountUnit): AmountUnit {
  return amountUnits[(amountUnits.indexOf(unit) + 1) % amountUnits.length];
}

// Thousands grouping through formatMoney, so the rule lives in one place.
const group = (value: bigint) => formatMoney(value.toString()).slice(0, -1);

export function convertAmount(total: Money, unit: AmountUnit): { text: string; caption: string } {
  formatMoney(total); // rejects invalid money before any BigInt parsing
  const amount = BigInt(total);
  switch (unit) {
    case 'won':
      return { text: formatMoney(total), caption: '오늘 쓴 돈' };
    case 'gukbap': {
      const tenths = (amount * 10n) / 10000n;
      return { text: `국밥 ${group(tenths / 10n)}.${tenths % 10n}그릇`, caption: '국밥 환산 · 1그릇 10,000원 기준' };
    }
    case 'samgak':
      return { text: `삼김 ${group(amount / 1500n)}개`, caption: '삼각김밥 환산 · 1개 1,500원 기준' };
    case 'alba': {
      const minutes = (amount * 60n) / 10320n;
      return { text: `알바 ${group(minutes / 60n)}시간 ${minutes % 60n}분`, caption: '알바 환산 · 시급 10,320원 기준' };
    }
  }
}

export function amountLabel(total: Money, unit: AmountUnit): string {
  const { text } = convertAmount(total, unit);
  return unit === 'won' ? `오늘 쓴 돈 ${formatMoney(total)}` : `오늘 쓴 돈 ${formatMoney(total)}, ${text}`;
}

export const pokeLines: Record<Band, string[]> = {
  calm: ['배불러~ 오늘은 내가 쏜다', '간지러워 ㅋㅋ', '찌르지 마, 이자 붙어'],
  caution: ['지금 찌를 때야?', '숨 좀 쉬자 숨 좀', '나 다이어트 한 적 없는데'],
  exceeded: ['털어도 먼지만 나와', '나방이 이사 갔어', '선글라스는 눈물 가리려고 낀 거야'],
};

export function pokeLine(band: Band, count: number): string {
  const safe = Number.isInteger(count) && count >= 0 ? count : 0;
  return pokeLines[band][safe % 3];
}

const badges: Record<Band, string> = { exceeded: '편의점 VIP', caution: '아슬아슬 줄타기꾼', calm: '지갑 지킴이' };
// Ties go to the heavier band: exceeded, then caution, then calm.
const tiePriority: Band[] = ['exceeded', 'caution', 'calm'];

export function monthBadge(counts: { band: Band; days: number }[]): string {
  const totals: Record<Band, number> = { calm: 0, caution: 0, exceeded: 0 };
  for (const { band, days } of counts) totals[band] += days;
  if (tiePriority.reduce((sum, band) => sum + totals[band], 0) === 0) return '칭호 대기 중';
  let top = tiePriority[0];
  for (const band of tiePriority) if (totals[band] > totals[top]) top = band;
  return badges[top];
}
