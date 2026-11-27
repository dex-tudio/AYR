import { requireOptionalNativeModule } from 'expo-modules-core';

// Decoration only: a missing module or a native failure must never surface to the user.
export function pokeFeedback(): void {
  try {
    requireOptionalNativeModule<{ impact(): void }>('AYRNative')?.impact();
  } catch {
    // ignore
  }
}
