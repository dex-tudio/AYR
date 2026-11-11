import type { AppSnapshot, Band, LedgerService, MonthDayState, MonthViewState, MutationResult, SettingsRequest } from './contracts.ts';
import { daysInMonth, invalidMonthMessage, positiveMoney, validMonthOffset } from './contracts.ts';

const maximumMoney = '25200470046051300';
// Same texts as Core LedgerError.errorDescription; a test compares them with the Swift source.
export const messages = {
  invalidAmount: '금액은 1원 이상, 입력 가능한 범위 안에서 숫자로만 적어주세요.',
  amountOverflow: '기록할 수 있는 최대 금액을 넘었어요.',
  notConfigured: '앱에서 시작하기를 먼저 마쳐주세요.',
  invalidStoredData: '저장된 기록을 읽지 못했어요. 기존 기록은 그대로 두었어요.',
  dayChanged: '날짜가 바뀌었어요. 오늘 기록을 확인한 뒤 다시 시도해주세요.',
  spendingChanged: '지출 목록이 바뀌었어요. 최신 기록을 확인한 뒤 다시 선택해주세요.',
} as const;
// SpendingStoreError (iOS/Shared/SpendingStore.swift) and LedgerBridgeState; tests compare them with the Swift sources.
export const storeMessages = {
  unreadable: '저장된 기록이 손상됐어요. 원본은 그대로 두었어요. 원본을 따로 보관하고 새로 시작할 수 있어요.',
  resetNotNeeded: '기록에 문제가 없어 새로 시작하지 않았어요. 다시 불러와주세요.',
  backupFailed: '원본을 따로 보관하지 못해 새로 시작하지 않았어요. 기존 기록은 그대로 두었어요.',
} as const;
const invalidSettings = '설정 값을 확인해주세요. 신분과 연결할 수 있는 결제 수단을 골라야 해요.';
export const bridgeMessages = { invalidSettings } as const;
const saveFailure = '저장하지 못했어요. 잠시 뒤 다시 시도해주세요.';
const fakeToday = '2026-11-11';
const fakeNextDay = '2026-11-12';
const fakeInstant = '2026-11-11T03:00:00.000Z';
const ignoredReception = '지원하는 결제 문자가 아니어서 지출에 더하지 않았어요.';
const testReception = '확인용 문자가 도착했어요. 지출에는 더하지 않았어요.';

const identities = [
  { raw: 'student', title: '학생', defaultBudget: '20000' },
  { raw: 'jobSeeker', title: '취준생', defaultBudget: '30000' },
  { raw: 'worker', title: '직장인', defaultBudget: '50000' },
];
const sourceInfos = [
  { raw: 'kbCheckSMS', title: 'KB국민 체크카드 · 문자', isSupported: true, filterKeyword: 'KB국민체크', testText: 'KB국민체크 AYR테스트', instructions: '단축어에서 문자 자동화를 만들고 AYR 결제 처리에 본문을 전달해주세요.' },
  { raw: 'tossNotification', title: '토스뱅크 체크카드·토스페이 · 토스 알림', isSupported: false, filterKeyword: null, testText: 'AYR테스트', instructions: '준비 중' },
];

export type PreviewScenario = 'default' | 'firstStart' | 'empty' | 'readFailure' | 'maximum' | 'readFailureOnce'
  | 'carried' | 'saveFailureOnce' | 'dayChange' | 'listChange'
  | 'firstStartSaveFailureOnce' | 'corrupt' | 'corruptResetFailureOnce' | 'mixedSources' | 'monthReadFailureOnce' | 'receptionFailure';

// Same texts as Core `phrase`; a test compares them with the Swift source.
export const phrases: Record<Band, string> = { calm: '아직은 여유 있네', caution: '오늘 좀 쓰는데?', exceeded: '님 부자임?' };
const bandOf = (total: bigint, budget: bigint): Band => total < budget / 2n + budget % 2n ? 'calm' : total < budget ? 'caution' : 'exceeded';

// Calendar arithmetic on yyyy-MM-dd text. Date.UTC only counts days in a month; no local time or ISO cutting is involved.
const pad = (value: number, size = 2) => String(value).padStart(size, '0');
const daysIn = daysInMonth;
function shiftMonth(month: string, by: number) {
  const index = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + by;
  return `${pad(Math.floor(index / 12), 4)}-${pad((index % 12) + 1)}`;
}

export type DayRecord = { total: bigint; budget: bigint };
/** The month as Core `summary` reports it, computed with BigInt for the fake ledger only. It is never used on the native path. */
export function summarizeMonth(input: { offset: number; month: string; today: string; records: Record<string, DayRecord>; budget: bigint }): MonthViewState {
  const { offset, month, today, records, budget } = input;
  const count = daysIn(month);
  const days: MonthDayState[] = Array.from({ length: count }, (_, index) => {
    const key = `${month}-${pad(index + 1)}`;
    const record = key <= today ? records[key] : undefined;
    if (!record) return { key, day: index + 1, status: key > today ? 'future' : 'noRecord', total: null, budget: null, phrase: null, band: null };
    const band = bandOf(record.total, record.budget);
    return { key, day: index + 1, status: 'recorded', total: String(record.total), budget: String(record.budget), phrase: phrases[band], band };
  });
  const total = days.reduce((sum, day) => sum + BigInt(day.total ?? '0'), 0n);
  // The compared span is today's date for the current month and the whole month otherwise, capped by the previous month's length.
  const span = today.startsWith(`${month}-`) ? Number(today.slice(8)) : count;
  const previous = shiftMonth(month, -1);
  const previousDays = Array.from({ length: Math.min(span, daysIn(previous)) }, (_, index) => records[`${previous}-${pad(index + 1)}`]);
  const covered = days.slice(0, span).every(day => day.status === 'recorded') && previousDays.every(record => record !== undefined);
  const difference = covered ? total - previousDays.reduce((sum, record) => sum + record!.total, 0n) : null;
  const remaining = budget - total;
  return {
    offset, monthKey: month, title: `${Number(month.slice(0, 4))}년 ${Number(month.slice(5, 7))}월`,
    canGoPrevious: offset > -11, canGoNext: offset < 0,
    weekdays: ['일', '월', '화', '수', '목', '금', '토'], leadingBlanks: new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1)).getUTCDay(),
    days, total: String(total), budget: String(budget), remaining: String(remaining < 0n ? -remaining : remaining), overBudget: remaining < 0n,
    comparison: difference === null ? null : { difference: String(difference < 0n ? -difference : difference), direction: difference > 0n ? 'more' : difference < 0n ? 'less' : 'same' },
    phraseCounts: (['calm', 'caution', 'exceeded'] as Band[]).map(band => ({ band, phrase: phrases[band], days: days.filter(day => day.band === band).length })),
  };
}
// Past days of the fake ledger: 2026-11-01..10 (add up with today's 32,400 to the 286,400 month), all of October, and the second half of September.
function seedRecords(): Record<string, DayRecord> {
  const budget = 50000n;
  const records: Record<string, DayRecord> = {};
  [12000, 0, 31000, 48000, 50000, 25000, 24000, 18000, 21000, 25000].forEach((total, index) => { records[`2026-11-${pad(index + 1)}`] = { total: BigInt(total), budget }; });
  const fake = (day: number) => BigInt(((day * 37) % 55) * 1000);
  for (let day = 1; day <= 31; day++) records[`2026-10-${pad(day)}`] = { total: fake(day), budget };
  for (let day = 16; day <= 30; day++) records[`2026-09-${pad(day)}`] = { total: fake(day), budget };
  return records;
}

// Session-memory fake ledger. Rules mirror Core with BigInt; it is never used on the native path.
export class PreviewLedger implements LedgerService {
  scenario: PreviewScenario;
  private reads = 0;
  private today = fakeToday;
  private day = fakeToday;
  private carried = 0n;
  private approvals: bigint[];
  private onboarded: boolean;
  private interfered = false;
  private saveFailed = false;
  private resetFailed = false;
  private corrupted: boolean;
  private identity = 'worker';
  private dailyBudget = 50000n;
  private monthlyBudget: bigint | null = 1500000n;
  private sources = ['kbCheckSMS'];
  // Finished days (today is added when read) and the monthly budget each month was given; past months keep theirs.
  private records: Record<string, DayRecord> = {};
  private monthBudgets: Record<string, bigint> = {};
  private monthFailed = false;
  private lastAttempt: { date: string; status: string; message: string } | null = null;
  private lastReception: string | null = null;
  constructor(scenario: PreviewScenario = 'default') {
    this.scenario = scenario;
    this.corrupted = scenario === 'corrupt' || scenario === 'corruptResetFailureOnce';
    // SwiftUI let an unsupported source stay in the saved settings; this scenario starts from such a ledger.
    if (scenario === 'mixedSources') this.sources = ['kbCheckSMS', 'tossNotification'];
    this.onboarded = scenario !== 'firstStart' && scenario !== 'firstStartSaveFailureOnce';
    this.approvals = scenario === 'empty' ? [] : scenario === 'maximum' ? [BigInt(maximumMoney)]
      : scenario === 'carried' ? [3000n] : [5100n, 8700n, 18600n];
    if (scenario === 'carried') this.carried = 12000n;
    // The shortcut called the app with a text that is not a supported payment: shown as the last call, never added.
    if (scenario === 'receptionFailure') { this.lastAttempt = { date: fakeInstant, status: 'ignored', message: ignoredReception }; this.lastReception = fakeInstant; }
    if (this.onboarded) {
      this.monthBudgets[fakeToday.slice(0, 7)] = 1500000n;
      if (scenario !== 'empty' && scenario !== 'maximum') {
        this.records = seedRecords();
        this.monthBudgets['2026-10'] = 1500000n; this.monthBudgets['2026-09'] = 1500000n;
      }
    }
  }
  /** Preview-only hook: the device clock passes midnight. */
  advanceDay() { this.today = fakeNextDay; }
  /** Preview-only hook: a payment notification is added by the shortcut. */
  receive(amount: string) { this.approvals.push(BigInt(amount)); }
  /** Preview-only hook: a self-sent confirmation text reaches the shortcut. It is shown as the last call, never added. */
  receiveTest() { this.lastAttempt = { date: fakeInstant, status: 'test', message: testReception }; this.lastReception = fakeInstant; }

  private refresh() {
    if (this.day === this.today) return;
    if (this.onboarded) this.records[this.day] = { total: this.total, budget: this.dailyBudget };
    this.day = this.today; this.approvals = []; this.carried = 0n;
  }
  private get total() { return this.approvals.reduce((sum, amount) => sum + amount, this.carried); }
  private token() { return `preview:${this.day}:${this.carried}:${this.approvals.join(',')}`; }
  // dayChange / listChange: the first change finds the world already moved on, like a real midnight or a notification.
  private interfere() {
    if (this.interfered) return;
    this.interfered = true;
    if (this.scenario === 'dayChange') this.advanceDay();
    if (this.scenario === 'listChange') this.receive('1200');
  }
  private get unreadable() { return this.scenario === 'readFailure' || this.corrupted; }
  private build(error: string | null, unreadable = false, canReset = false): AppSnapshot {
    const total = this.total;
    const budget = this.dailyBudget;
    const band = bandOf(total, budget);
    return {
      ledger: unreadable ? null : {
        onboardingCompleted: this.onboarded,
        current: { day: this.day, total: total.toString(), budget: budget.toString(), carriedTotal: this.carried.toString(),
          approvals: this.approvals.map(String), expectedCurrent: this.token() },
        settings: { identity: this.identity, dailyBudget: budget.toString(), monthlyBudget: this.monthlyBudget?.toString() ?? null, sources: [...this.sources] },
        lastReception: this.lastReception, lastAttempt: this.lastAttempt,
        phrase: phrases[band], band,
      },
      error: error ? { message: error, canReset } : null,
      activityNotice: null, activityEnabled: false, resettingRecords: false,
      metadata: {
        maximumMoney,
        identities,
        sources: sourceInfos,
      },
    };
  }
  private fail(message: string, canReset = false): MutationResult {
    return { ok: false, snapshot: this.build(message, this.unreadable, canReset) };
  }
  private done(): MutationResult { return { ok: true, snapshot: this.build(null) }; }
  // saveFailureOnce: the first write is refused and nothing changes; a retry succeeds.
  private writeRefused() {
    if ((this.scenario !== 'saveFailureOnce' && this.scenario !== 'firstStartSaveFailureOnce') || this.saveFailed) return false;
    return this.saveFailed = true;
  }

  async getSnapshot(): Promise<AppSnapshot> {
    this.refresh();
    if (this.corrupted) return this.build(storeMessages.unreadable, true, true);
    // readFailureOnce: the first read fails, a retry succeeds.
    const failing = this.scenario === 'readFailure' || (this.scenario === 'readFailureOnce' && this.reads++ === 0);
    return this.build(failing ? '기록을 불러오지 못했어요. 다시 시도해주세요.' : null, failing);
  }
  async getMonth(offset: number): Promise<MonthViewState> {
    if (!validMonthOffset(offset)) throw new RangeError(invalidMonthMessage);
    this.refresh();
    if (this.corrupted) throw new Error(storeMessages.unreadable);
    // monthReadFailureOnce: the first month read fails while the rest of the ledger reads fine; a retry succeeds.
    const failOnce = this.scenario === 'monthReadFailureOnce' && !this.monthFailed;
    if (failOnce) this.monthFailed = true;
    if (this.scenario === 'readFailure' || failOnce) throw new Error('기록을 불러오지 못했어요. 다시 시도해주세요.');
    const month = shiftMonth(this.day.slice(0, 7), offset);
    const records = this.onboarded ? { ...this.records, [this.day]: { total: this.total, budget: this.dailyBudget } } : this.records;
    const budget = this.monthBudgets[month] ?? this.monthlyBudget ?? this.dailyBudget * BigInt(daysIn(month));
    return summarizeMonth({ offset, month, today: this.day, records, budget });
  }
  async addSpending(amount: string, expectedDay: string): Promise<MutationResult> {
    this.interfere(); this.refresh();
    if (this.corrupted) return this.fail(storeMessages.unreadable, true);
    if (this.scenario === 'readFailure') return this.fail(messages.invalidStoredData);
    if (!this.onboarded) return this.fail(messages.notConfigured);
    if (expectedDay !== this.day) return this.fail(messages.dayChanged);
    const valid = positiveMoney(amount, maximumMoney);
    if (!valid) return this.fail(messages.invalidAmount);
    if (BigInt(valid) > BigInt(maximumMoney) - this.total) return this.fail(messages.amountOverflow);
    if (this.writeRefused()) return this.fail(saveFailure);
    this.approvals.push(BigInt(valid));
    return this.done();
  }
  async removeSpending(index: number, expectedCurrent: string): Promise<MutationResult> {
    this.interfere(); this.refresh();
    if (this.corrupted) return this.fail(storeMessages.unreadable, true);
    if (this.scenario === 'readFailure') return this.fail(messages.invalidStoredData);
    if (!this.onboarded) return this.fail(messages.notConfigured);
    const day = /^preview:([0-9-]+):/.exec(expectedCurrent)?.[1];
    if (day !== undefined && day !== this.day) return this.fail(messages.dayChanged);
    if (expectedCurrent !== this.token() || !Number.isSafeInteger(index) || index < 0 || index >= this.approvals.length) {
      return this.fail(messages.spendingChanged);
    }
    if (this.writeRefused()) return this.fail(saveFailure);
    this.approvals.splice(index, 1);
    return this.done();
  }
  async saveSettings(request: SettingsRequest): Promise<MutationResult> {
    this.refresh();
    if (this.corrupted) return this.fail(storeMessages.unreadable, true);
    if (this.scenario === 'readFailure') return this.fail(messages.invalidStoredData);
    const known = identities.some(item => item.raw === request.identity);
    const supported = request.sources.length > 0 && request.sources.every(raw => sourceInfos.some(item => item.raw === raw && item.isSupported));
    if (!known || !supported) return this.fail(invalidSettings);
    const daily = positiveMoney(request.dailyBudget, maximumMoney);
    const monthly = request.monthlyBudget === null ? null : positiveMoney(request.monthlyBudget, maximumMoney);
    if (daily === null || (request.monthlyBudget !== null && monthly === null)) return this.fail(messages.invalidAmount);
    if (this.writeRefused()) return this.fail(saveFailure);
    this.identity = request.identity;
    this.dailyBudget = BigInt(daily);
    this.monthlyBudget = monthly === null ? null : BigInt(monthly);
    this.sources = [...request.sources];
    if (request.finishOnboarding) this.onboarded = true;
    // Only this month is re-budgeted; months that already have a budget keep theirs.
    if (this.onboarded) { const month = this.day.slice(0, 7); this.monthBudgets[month] = this.monthlyBudget ?? this.dailyBudget * BigInt(daysIn(month)); }
    return this.done();
  }
  async resetRecords(): Promise<MutationResult> {
    if (!this.corrupted) return this.fail(storeMessages.resetNotNeeded);
    // corruptResetFailureOnce: the original cannot be kept aside the first time, so nothing is replaced.
    if (this.scenario === 'corruptResetFailureOnce' && !this.resetFailed) {
      this.resetFailed = true;
      return this.fail(storeMessages.backupFailed, true);
    }
    this.corrupted = false; this.onboarded = false; this.identity = 'student'; this.dailyBudget = 20000n; this.monthlyBudget = null;
    this.sources = ['kbCheckSMS']; this.approvals = []; this.carried = 0n; this.lastAttempt = null; this.lastReception = null;
    this.records = {}; this.monthBudgets = {};
    return this.done();
  }
}
