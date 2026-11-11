import type { LedgerService } from './contracts.ts';
import { invalidMonthMessage, validMonthOffset } from './contracts.ts';
import { nativeMessage } from './nativeError.ts';

async function native(): Promise<LedgerService> {
  try {
    const { requireNativeModule } = await import('expo-modules-core');
    return requireNativeModule<LedgerService>('AYRNative');
  } catch (cause) {
    throw new Error('AYRNative를 찾지 못했어요. 전용 iOS 앱 빌드에서 다시 실행해주세요.', { cause });
  }
}

// A native failure reaches JS wrapped in English by Expo; callers get only the Korean reason.
async function call<T>(run: (module: LedgerService) => Promise<T>): Promise<T> {
  const module = await native();
  try { return await run(module); } catch (cause) { throw new Error(nativeMessage(cause), { cause }); }
}

// Amounts stay decimal text and the opaque expectedCurrent is passed through untouched; Swift validates both.
export const ledgerService: LedgerService = {
  async getSnapshot() { return call(module => module.getSnapshot()); },
  async getMonth(offset) {
    // Expo converts numbers to Int by rounding, so only an integer inside -11...0 goes to Swift (which checks again).
    if (!validMonthOffset(offset)) throw new RangeError(invalidMonthMessage);
    return call(module => module.getMonth(offset));
  },
  async addSpending(amount, expectedDay) { return call(module => module.addSpending(amount, expectedDay)); },
  async removeSpending(index, expectedCurrent) {
    // Expo converts numbers to Int by rounding and cannot take NaN or infinity, so only a plain index goes to Swift.
    if (!Number.isSafeInteger(index) || index < 0) throw new RangeError('삭제할 지출을 다시 선택해주세요.');
    return call(module => module.removeSpending(index, expectedCurrent));
  },
  async saveSettings(request) { return call(module => module.saveSettings(request)); },
  async resetRecords() { return call(module => module.resetRecords()); },
};
// Only the browser can simulate a received text; on iPhone the real shortcut does it.
export const simulateTestReception: (() => void) | null = null;
