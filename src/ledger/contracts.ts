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
export type MutationResult = { ok: boolean; snapshot: AppSnapshot };
export interface LedgerService {
  getSnapshot(): Promise<AppSnapshot>;
  /** amount is decimal text; expectedDay is the day the user saw when they typed it. */
  addSpending(amount: Money, expectedDay: string): Promise<MutationResult>;
  /** index addresses current.approvals only; expectedCurrent is the opaque value issued with the snapshot. */
  removeSpending(index: number, expectedCurrent: string): Promise<MutationResult>;
}

const digits = /^[0-9]+$/;

// Engine-independent grouping (no Intl/toLocaleString). Invalid text throws instead of showing 0원.
export function formatMoney(value: Money): string {
  if (typeof value !== 'string' || !digits.test(value)) throw new RangeError('금액 형식이 올바르지 않아요.');
  return `${BigInt(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}원`;
}
// Rejects a snapshot whose amounts are not decimal text or do not add up, so the screen shows a read error rather than a wrong amount.
export function assertSnapshotMoney(snapshot: AppSnapshot): AppSnapshot {
  const bad = () => new RangeError('기록의 금액 형식이 올바르지 않아요.');
  const isMoney = (value: unknown): value is string => typeof value === 'string' && digits.test(value);
  if (!isMoney(snapshot.metadata.maximumMoney)) throw bad();
  const ledger = snapshot.ledger;
  if (ledger) {
    const { total, budget, carriedTotal, approvals, expectedCurrent } = ledger.current;
    if (!Array.isArray(approvals) || typeof expectedCurrent !== 'string') throw bad();
    if (![total, budget, carriedTotal, ...approvals].every(isMoney)) throw bad();
    if (BigInt(total) !== approvals.reduce((sum, amount) => sum + BigInt(amount), BigInt(carriedTotal))) throw bad();
  }
  return snapshot;
}
export function positiveMoney(value: string, maximum: Money): Money | null {
  if (!digits.test(value)) return null;
  const amount = BigInt(value);
  return amount > 0n && amount <= BigInt(maximum) ? amount.toString() : null;
}
