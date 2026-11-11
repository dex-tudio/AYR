import type { LedgerService } from './contracts.ts';

async function native(): Promise<LedgerService> {
  try {
    const { requireNativeModule } = await import('expo-modules-core');
    return requireNativeModule<LedgerService>('AYRNative');
  } catch (cause) {
    throw new Error('AYRNative를 찾지 못했어요. 전용 iOS 앱 빌드에서 다시 실행해주세요.', { cause });
  }
}

// Amounts stay decimal text and the opaque expectedCurrent is passed through untouched; Swift validates both.
export const ledgerService: LedgerService = {
  async getSnapshot() { return (await native()).getSnapshot(); },
  async addSpending(amount, expectedDay) { return (await native()).addSpending(amount, expectedDay); },
  async removeSpending(index, expectedCurrent) { return (await native()).removeSpending(index, expectedCurrent); },
};
