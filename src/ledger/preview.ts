import type { AppSnapshot, LedgerService } from './contracts.ts';

const maximumMoney = '25200470046051300';
export type PreviewScenario = 'default' | 'firstStart' | 'empty' | 'readFailure' | 'maximum';
export class PreviewLedger implements LedgerService {
  scenario: PreviewScenario;
  constructor(scenario: PreviewScenario = 'default') { this.scenario = scenario; }
  async getSnapshot(): Promise<AppSnapshot> {
    const approvals = this.scenario === 'empty' ? [] : this.scenario === 'maximum' ? [maximumMoney] : ['5100', '8700', '18600'];
    const total = approvals.reduce((sum, amount) => sum + BigInt(amount), 0n);
    const budget = 50000n;
    const band = total < (budget + 1n) / 2n ? 'calm' : total < budget ? 'caution' : 'exceeded';
    return {
      ledger: this.scenario === 'readFailure' ? null : {
        onboardingCompleted: this.scenario !== 'firstStart',
        current: { day: '2026-11-11', total: total.toString(), budget: budget.toString(), carriedTotal: '0', approvals, expectedCurrent: 'preview-only' },
        settings: { identity: 'worker', dailyBudget: '50000', monthlyBudget: '1500000', sources: ['kbCheckSMS'] },
        lastReception: null, lastAttempt: null,
        phrase: { calm: '아직은 여유 있네', caution: '오늘 좀 쓰는데?', exceeded: '님 부자임?' }[band], band,
      },
      error: this.scenario === 'readFailure' ? { message: '기록을 불러오지 못했어요. 다시 시도해주세요.', canReset: false } : null,
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
}
