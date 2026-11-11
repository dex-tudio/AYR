import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';

/** A money text that never loses a digit: it shrinks to the measured width (web has no adjustsFontSizeToFit) and the won unit stays visible. */
export function FitAmount({ text, max = 46, testID, label }: { text: string; max?: number; testID?: string; label?: string }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  // 0.62em is wider than any digit, so the measured width always holds the text.
  const size = width ? Math.min(max, Math.max(12, Math.floor(width / (text.length * 0.62)))) : max;
  return <View onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    <Text testID={testID} accessibilityLabel={label} adjustsFontSizeToFit numberOfLines={1} minimumFontScale={0.3}
      style={[styles.amount, { color: theme.ink, fontSize: size }]}>{text}</Text>
  </View>;
}
const styles = StyleSheet.create({ amount: { fontWeight: '800', letterSpacing: -1.5, flexShrink: 1 } });
