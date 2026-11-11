export type Money = string;
export type IdentityInfo = { raw: string; title: string; defaultBudget: Money };
export type SourceInfo = {
  raw: string; title: string; isSupported: boolean; filterKeyword: string | null;
  testText: string; instructions: string;
};
export type AppSnapshot = {
  ledger: {
    onboardingCompleted: boolean;
    current: { day: string; total: Money; budget: Money; carriedTotal: Money; approvals: Money[]; expectedCurrent: string };
    settings: { identity: string; dailyBudget: Money; monthlyBudget: Money | null; sources: string[] };
    lastReception: string | null;
    lastAttempt: { date: string; status: string; message: string } | null;
    phrase: string; band: 'calm' | 'caution' | 'exceeded';
  } | null;
  error: { message: string; canReset: boolean } | null;
  activityNotice: string | null; activityEnabled: boolean; resettingRecords: boolean;
  metadata: { maximumMoney: Money; identities: IdentityInfo[]; sources: SourceInfo[] };
};
export interface LedgerService { getSnapshot(): Promise<AppSnapshot> }

export function formatMoney(value: Money): string {
  return `${BigInt(value).toLocaleString('ko-KR')}원`;
}
export function positiveMoney(value: string, maximum: Money): Money | null {
  if (!/^[0-9]+$/.test(value)) return null;
  const amount = BigInt(value);
  return amount > 0n && amount <= BigInt(maximum) ? amount.toString() : null;
}
