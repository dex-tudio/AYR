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
export type Band = 'calm' | 'caution' | 'exceeded';
/** recorded: a day with a record (0원 included); noRecord: before recording started or missed; future: has not come yet. */
export type MonthDayState = {
  key: string; day: number; status: 'recorded' | 'noRecord' | 'future';
  total: Money | null; budget: Money | null; phrase: string | null; band: Band | null;
};
/** Everything the monthly screen shows. Amounts are decimal text; remaining and comparison carry a separate direction instead of a sign. */
export type MonthViewState = {
  offset: number; monthKey: string; title: string; canGoPrevious: boolean; canGoNext: boolean;
  weekdays: string[]; leadingBlanks: number; days: MonthDayState[];
  total: Money; budget: Money; remaining: Money; overBudget: boolean;
  comparison: { difference: Money; direction: 'more' | 'less' | 'same' } | null;
  phraseCounts: { band: Band; phrase: string; days: number }[];
};
export type MutationResult = { ok: boolean; snapshot: AppSnapshot };
/** identity and sources are raw values from metadata; Swift validates them again. monthlyBudget null means daily budget x days in the month. */
export type SettingsRequest = { identity: string; dailyBudget: Money; monthlyBudget: Money | null; sources: string[]; finishOnboarding: boolean };
export type SettingsDraft = { identity: string; dailyBudget: string; customMonthly: boolean; monthlyBudget: string; sources: string[] };
export interface LedgerService {
  getSnapshot(): Promise<AppSnapshot>;
  /** Re-read and sync the native Live Activity; a display failure is separate from a saved spending. */
  refreshActivity(): Promise<AppSnapshot>;
  /** offset 0 is this month and -11 the oldest kept month; anything else is refused. */
  getMonth(offset: number): Promise<MonthViewState>;
  /** amount is decimal text; expectedDay is the day the user saw when they typed it. */
  addSpending(amount: Money, expectedDay: string): Promise<MutationResult>;
  /** index addresses current.approvals only; expectedCurrent is the opaque value issued with the snapshot. */
  removeSpending(index: number, expectedCurrent: string): Promise<MutationResult>;
  saveSettings(request: SettingsRequest): Promise<MutationResult>;
  /** Only after an explicit confirmation, and only for a damaged record: the original is kept aside and a new ledger starts. */
  resetRecords(): Promise<MutationResult>;
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
    const { dailyBudget, monthlyBudget } = ledger.settings;
    if (!isMoney(dailyBudget) || (monthlyBudget !== null && !isMoney(monthlyBudget))) throw bad();
  }
  if (!Array.isArray(snapshot.metadata.identities) || !snapshot.metadata.identities.every(item => isMoney(item.defaultBudget))) throw bad();
  return snapshot;
}
export const monthOffsets = { oldest: -11, newest: 0 } as const;
export const invalidMonthMessage = '볼 수 있는 달이 아니에요. 이번 달부터 11개월 전까지만 볼 수 있어요.';
/** Days in a yyyy-MM month. Date.UTC only counts calendar days here; no local time or ISO cutting is involved. */
export const daysInMonth = (month: string) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
export function validMonthOffset(offset: unknown): offset is number {
  return typeof offset === 'number' && Number.isSafeInteger(offset) && offset >= monthOffsets.oldest && offset <= monthOffsets.newest;
}
// Rejects a month response that is malformed or does not add up, so the screen shows a read error rather than a wrong amount.
export function assertMonthState(month: MonthViewState, offset: number): MonthViewState {
  const bad = () => new RangeError('월 기록의 형식이 올바르지 않아요.');
  const isMoney = (value: unknown): value is string => typeof value === 'string' && digits.test(value);
  const bands = ['calm', 'caution', 'exceeded'];
  if (!month || month.offset !== offset || !validMonthOffset(month.offset) || !Array.isArray(month.days) || !Array.isArray(month.phraseCounts)) throw bad();
  if (typeof month.title !== 'string' || typeof month.monthKey !== 'string' || !/^\d{4}-\d{2}$/.test(month.monthKey)) throw bad();
  if (month.canGoPrevious !== (offset > monthOffsets.oldest) || month.canGoNext !== (offset < monthOffsets.newest)) throw bad();
  if (!Array.isArray(month.weekdays) || month.weekdays.length !== 7 || !month.weekdays.every(item => typeof item === 'string')) throw bad();
  if (!Number.isInteger(month.leadingBlanks) || month.leadingBlanks < 0 || month.leadingBlanks > 6) throw bad();
  if (month.days.length !== daysInMonth(month.monthKey)) throw bad();
  if (![month.total, month.budget, month.remaining].every(isMoney) || typeof month.overBudget !== 'boolean') throw bad();
  const counts: Record<string, number> = { calm: 0, caution: 0, exceeded: 0 };
  let sum = 0n;
  month.days.forEach((day, index) => {
    if (day.day !== index + 1 || typeof day.key !== 'string' || !day.key.startsWith(`${month.monthKey}-`)) throw bad();
    if (day.status === 'recorded') {
      if (!isMoney(day.total) || !isMoney(day.budget) || typeof day.phrase !== 'string' || !bands.includes(day.band as string)) throw bad();
      sum += BigInt(day.total);
      counts[day.band as string] += 1;
    } else if (day.status !== 'noRecord' && day.status !== 'future') throw bad();
    else if (day.total !== null || day.budget !== null || day.phrase !== null || day.band !== null) throw bad();
  });
  if (sum !== BigInt(month.total)) throw bad();
  const remaining = BigInt(month.budget) - BigInt(month.total);
  if (BigInt(month.remaining) !== (remaining < 0n ? -remaining : remaining) || month.overBudget !== (remaining < 0n)) throw bad();
  if (month.comparison !== null) {
    const { difference, direction } = month.comparison;
    if (!isMoney(difference) || !['more', 'less', 'same'].includes(direction) || (direction === 'same') !== (BigInt(difference) === 0n)) throw bad();
  }
  if (month.phraseCounts.length !== 3 || month.phraseCounts.some((item, index) => item.band !== bands[index] || typeof item.phrase !== 'string' || item.days !== counts[item.band])) throw bad();
  if (month.days.some(day => day.status === 'recorded' && day.phrase !== month.phraseCounts.find(item => item.band === day.band)?.phrase)) throw bad();
  return month;
}
export function positiveMoney(value: string, maximum: Money): Money | null {
  if (!digits.test(value)) return null;
  const amount = BigInt(value);
  return amount > 0n && amount <= BigInt(maximum) ? amount.toString() : null;
}

export function identityDefault(metadata: AppSnapshot['metadata'], raw: string): Money | null {
  return metadata.identities.find(item => item.raw === raw)?.defaultBudget ?? null;
}
const supportedRaws = (metadata: AppSnapshot['metadata']) => metadata.sources.filter(item => item.isSupported).map(item => item.raw);
/** Titles of the sources that can be connected, for texts that must not hard-code a payment source. */
export function supportedTitles(metadata: AppSnapshot['metadata']): string {
  return metadata.sources.filter(item => item.isSupported).map(item => item.title).join(', ');
}
/** The form starts from saved settings. Saved sources that are not supported (SwiftUI allowed them) are dropped, so the form can be saved;
 *  if none is left it starts from the supported ones. */
export function draftFromSettings(settings: NonNullable<AppSnapshot['ledger']>['settings'], metadata: AppSnapshot['metadata']): SettingsDraft {
  const supported = supportedRaws(metadata);
  const kept = settings.sources.filter(raw => supported.includes(raw));
  return {
    identity: settings.identity, dailyBudget: settings.dailyBudget, customMonthly: settings.monthlyBudget !== null,
    monthlyBudget: settings.monthlyBudget ?? '', sources: kept.length > 0 ? kept : supported,
  };
}
/** The request the user may send, or null while the form is invalid. Support comes from metadata, never from a JS list. */
export function settingsRequest(draft: SettingsDraft, metadata: AppSnapshot['metadata'], finishOnboarding: boolean): SettingsRequest | null {
  const dailyBudget = positiveMoney(draft.dailyBudget, metadata.maximumMoney);
  const monthlyBudget = draft.customMonthly ? positiveMoney(draft.monthlyBudget, metadata.maximumMoney) : null;
  const supported = draft.sources.length > 0 && draft.sources.every(raw => metadata.sources.some(item => item.raw === raw && item.isSupported));
  if (dailyBudget === null || (draft.customMonthly && monthlyBudget === null) || !supported || identityDefault(metadata, draft.identity) === null) return null;
  return { identity: draft.identity, dailyBudget, monthlyBudget, sources: draft.sources, finishOnboarding };
}

const two = (value: number) => String(value).padStart(2, '0');
// Device-local wall time of an instant; engine-independent like formatMoney.
export function formatInstant(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.getFullYear()}. ${two(date.getMonth() + 1)}. ${two(date.getDate())}. ${two(date.getHours())}:${two(date.getMinutes())}`;
}
type LedgerState = NonNullable<AppSnapshot['ledger']>;
/** Last automation call as shown to the user. Only a success or test call counts as connected; no call is never success. */
export function describeReception(ledger: LedgerState): { text: string; success: boolean; at: string | null } {
  const attempt = ledger.lastAttempt;
  if (attempt) {
    return { text: attempt.message, success: attempt.status === 'success' || attempt.status === 'test', at: `마지막 문자 도착: ${formatInstant(attempt.date)}` };
  }
  if (ledger.lastReception) {
    return { text: `마지막 연결: ${formatInstant(ledger.lastReception)} · 다음 문자부터 처리 결과도 함께 보여드려요.`, success: false, at: null };
  }
  return { text: '아직 도착한 결제 문자가 없어요', success: false, at: null };
}
