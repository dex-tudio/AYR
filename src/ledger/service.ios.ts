import type { AppSnapshot, LedgerService } from './contracts.ts';

export const ledgerService: LedgerService = {
  async getSnapshot(): Promise<AppSnapshot> {
    let native: LedgerService;
    try {
      const { requireNativeModule } = await import('expo-modules-core');
      native = requireNativeModule<LedgerService>('AYRNative');
    } catch (cause) {
      throw new Error('AYRNative를 찾지 못했어요. 전용 iOS 앱 빌드에서 다시 실행해주세요.', { cause });
    }
    return native.getSnapshot();
  },
};
