import { Platform, useColorScheme } from 'react-native';
import { palette } from './themePalette.ts';

export { moodBackground, palette } from './themePalette.ts';
export const fonts = {
  display: Platform.select({ ios: 'BlackHanSans-Regular', default: '"Black Han Sans", "Apple SD Gothic Neo", sans-serif' })!,
};
export function useTheme() {
  return palette(useColorScheme() === 'dark');
}
