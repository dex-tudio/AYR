import type { AppSnapshot, LedgerService, MutationResult, SettingsRequest } from './contracts.ts';
import { positiveMoney } from './contracts.ts';

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
const testReception = '확인용 문자가 도착했어요. 지출에는 더하지 않았어요.';

export type PreviewScenario = 'default' | 'firstStart' | 'empty' | 'readFailure' | 'maximum' | 'readFailureOnce'
  | 'carried' | 'saveFailureOnce' | 'dayChange' | 'listChange'
  | 'firstStartSaveFailureOnce' | 'corrupt' | 'corruptResetFailureOnce';

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
  private lastAttempt: { date: string; status: string; message: string } | null = null;
  private lastReception: string | null = null;
  constructor(scenario: PreviewScenario = 'default') {
    this.scenario = scenario;
    this.corrupted = scenario === 'corrupt' || scenario === 'corruptResetFailureOnce';
    this.onboarded = scenario !== 'firstStart' && scenario !== 'firstStartSaveFailureOnce';
    this.approvals = scenario === 'empty' ? [] : scenario === 'maximum' ? [BigInt(maximumMoney)]
      : scenario === 'carried' ? [3000n] : [5100n, 8700n, 18600n];
    if (scenario === 'carried') this.carried = 12000n;
  }
  /** Preview-only hook: the device clock passes midnight. */
  advanceDay() { this.today = fakeNextDay; }
  /** Preview-only hook: a payment notification is added by the shortcut. */
  receive(amount: string) { this.approvals.push(BigInt(amount)); }
  /** Preview-only hook: a self-sent confirmation text reaches the shortcut. It is shown as the last call, never added. */
  receiveTest() { this.lastAttempt = { date: fakeInstant, status: 'test', message: testReception }; this.lastReception = fakeInstant; }

  private refresh() {
    if (this.day === this.today) return;
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
    const band = total < (budget + 1n) / 2n ? 'calm' : total < budget ? 'caution' : 'exceeded';
    return {
      ledger: unreadable ? null : {
        onboardingCompleted: this.onboarded,
        current: { day: this.day, total: total.toString(), budget: budget.toString(), carriedTotal: this.carried.toString(),
          approvals: this.approvals.map(String), expectedCurrent: this.token() },
        settings: { identity: this.identity, dailyBudget: budget.toString(), monthlyBudget: this.monthlyBudget?.toString() ?? null, sources: [...this.sources] },
        lastReception: this.lastReception, lastAttempt: this.lastAttempt,
        phrase: { calm: '아직은 여유 있네', caution: '오늘 좀 쓰는데?', exceeded: '님 부자임?' }[band], band,
      },
      error: error ? { message: error, canReset } : null,
      activityNotice: null, activityEnabled: false, resettingRecords: false,
      metadata: {
        maximumMoney,
        identities: [
          { raw: 'student', title: '학생', defaultBudget: '20000' },
          { raw: 'jobSeeker', title: '취준생', defaultBudget: '30000' },
          { raw: 'worker', title: '직장인', defaultBudget: '50000' },
        ],
        sources: [
          { raw: 'kbCheckSMS', title: 'KB국민 체크카드 · 문자', isSupported: true, filterKeyword: 'KB국민체크', testText: 'KB국민체크 AYR테스트', instructions: '단축어에서 문자 자동화를 만들고 AYR 결제 처리에 본문을 전달해주세요.' },
          { raw: 'tossNotification', title: '토스뱅크 체크카드·토스페이 · 토스 알림', isSupported: false, filterKeyword: null, testText: 'AYR테스트', instructions: '준비 중' },
        ],
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
    const known = ['student', 'jobSeeker', 'worker'].includes(request.identity);
    const supported = request.sources.length > 0 && request.sources.every(raw => raw === 'kbCheckSMS');
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
    return this.done();
  }
}
