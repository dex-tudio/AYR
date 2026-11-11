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

const digits = /^[0-9]+$/;

// Engine-independent grouping (no Intl/toLocaleString). Invalid text throws instead of showing 0원.
export function formatMoney(value: Money): string {
  if (typeof value !== 'string' || !digits.test(value)) throw new RangeError('금액 형식이 올바르지 않아요.');
  return `${BigInt(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}원`;
}
// Rejects a snapshot whose amounts are not decimal text, so the screen shows a read error rather than a wrong amount.
export function assertSnapshotMoney(snapshot: AppSnapshot): AppSnapshot {
  const ledger = snapshot.ledger;
  if (ledger) {
    const values = [ledger.current.total, ledger.current.budget, ledger.current.carriedTotal, ...ledger.current.approvals];
    if (!values.every(value => typeof value === 'string' && digits.test(value))) throw new RangeError('기록의 금액 형식이 올바르지 않아요.');
  }
  return snapshot;
}
export function positiveMoney(value: string, maximum: Money): Money | null {
  if (!digits.test(value)) return null;
  const amount = BigInt(value);
  return amount > 0n && amount <= BigInt(maximum) ? amount.toString() : null;
}
