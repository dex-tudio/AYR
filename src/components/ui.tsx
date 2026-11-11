import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';

export function Card({ children, title }: { children: ReactNode; title?: string }) {
  const theme = useTheme();
  return <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
    {title && <Text accessibilityRole="header" style={[styles.heading, { color: theme.ink }]}>{title}</Text>}
    {children}
  </View>;
}
export function Body({ children, small, testID }: { children: ReactNode; small?: boolean; testID?: string }) {
  const theme = useTheme();
  return <Text testID={testID} style={{ color: theme.secondary, fontSize: small ? 12 : 14, lineHeight: small ? 20 : 22 }}>{children}</Text>;
}
// A failure the user must see; role alert so a screen reader announces it.
export function Alert({ title, message }: { title?: string; message: string }) {
  const theme = useTheme();
  return <View accessibilityRole="alert" style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
    {title && <Text accessibilityRole="header" style={[styles.heading, { color: theme.exceeded }]}>{title}</Text>}
    <Text style={{ color: theme.exceeded, fontSize: 16 }}>{message}</Text>
  </View>;
}
export function Button({ label, onPress, disabled, tone = 'plain', accessibilityLabel }: {
  label: string; onPress: () => void; disabled?: boolean; tone?: 'primary' | 'plain' | 'danger'; accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const primary = tone === 'primary';
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ disabled: !!disabled }}
    disabled={disabled} onPress={onPress}
    style={[styles.button, primary && { backgroundColor: theme.lime, borderRadius: 16, alignItems: 'center', paddingHorizontal: 20 }, { opacity: disabled ? 0.5 : 1 }]}>
    <Text style={{ color: primary ? theme.limeInk : tone === 'danger' ? theme.exceeded : theme.ink, fontSize: 16, fontWeight: primary || tone === 'danger' ? '700' : '400' }}>{label}</Text>
  </Pressable>;
}
const styles = StyleSheet.create({
  card: { padding: 20, borderWidth: 1, borderRadius: 20, gap: 12 }, heading: { fontSize: 18, fontWeight: '700' },
  button: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'flex-start' },
});
