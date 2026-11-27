import { View, type ViewStyle } from 'react-native';
import type { Band } from '../ledger/contracts';
import { useTheme } from '../theme';

const W = 30, H = 26, LINE = 2;
const box = (left: number, top: number, width: number, height: number, extra: ViewStyle = {}): ViewStyle => ({ position: 'absolute', left, top, width, height, ...extra });

/** Small wallet face for calendar cells (30x26 base, scaled by size). Decorative: the cell's own label already says the phrase. */
export function CritterFace({ band, size = 28 }: { band: Band; size?: number }) {
  const theme = useTheme();
  const c = theme.critterLine;
  const mood = { calm: theme.moodCalm, caution: theme.moodCaution, exceeded: theme.moodExceeded }[band];
  const eye = (left: number) => <View key={left} style={box(left, 12, 4, 4, { backgroundColor: c, borderRadius: 2 })} />;
  const body = (top: number, height: number) => <View style={box(1, top, 28, height, { backgroundColor: mood, borderColor: c, borderWidth: LINE, borderRadius: 8 })} />;
  let art;
  if (band === 'calm') {
    art = <>
      {body(3, 21)}{eye(8)}{eye(18)}
      <View style={box(11, 16, 8, 4, { borderBottomWidth: LINE, borderLeftWidth: LINE, borderRightWidth: LINE, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, borderColor: c })} />
    </>;
  } else if (band === 'caution') {
    art = <>
      {body(5, 19)}{eye(8)}{eye(18)}
      <View style={box(11, 19, 8, LINE, { backgroundColor: c })} />
      <View style={box(23, 1, 5, 5, { backgroundColor: theme.tear, borderColor: c, borderWidth: 1, borderRadius: 3, borderTopLeftRadius: 0, transform: [{ rotate: '45deg' }] })} />
    </>;
  } else {
    art = <>
      {body(10, 14)}
      <View style={box(6, 13, 8, 5, { backgroundColor: c, borderRadius: 2 })} />
      <View style={box(16, 13, 8, 5, { backgroundColor: c, borderRadius: 2 })} />
      <View style={box(13, 14, 4, LINE, { backgroundColor: c })} />
    </>;
  }
  const k = size / H;
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ width: W * k, height: size }}>
    <View style={{ width: W, height: H, transform: [{ scale: k }], transformOrigin: 'top left' }}>{art}</View>
  </View>;
}
