import { useColorScheme } from 'react-native';
export function useTheme() {
  const dark = useColorScheme() === 'dark';
  return {
    background: dark ? '#1C2019' : '#F7F5EE', surface: dark ? '#2A3024' : '#FFFFFF',
    ink: dark ? '#F2F3E9' : '#252B20', secondary: dark ? '#B6BDAA' : '#626A59',
    line: dark ? '#444B3C' : '#E2E4DA', lime: '#D5F56B', limeInk: '#252B20',
    calm: dark ? '#9AD8AB' : '#24643D', caution: dark ? '#FFD18A' : '#875000',
    exceeded: dark ? '#FFA4A2' : '#AC353D',
  };
}
