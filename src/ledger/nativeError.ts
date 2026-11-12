export const nativeFailure = '기록을 처리하지 못했어요. 잠시 뒤 다시 시도해주세요.';
const causeSeparator = '\n→ Caused by: ';

/** Expo wraps a native error as "Calling the 'x' function has failed\n→ Caused by: <reason>". Only the last Korean reason is for the user;
 *  English internals (the wrapper line, system errors) become one fixed Korean text. */
export function nativeMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : '';
  const last = text.split(causeSeparator).pop()?.trim() ?? '';
  return /[가-힣]/.test(last) ? last : nativeFailure;
}
