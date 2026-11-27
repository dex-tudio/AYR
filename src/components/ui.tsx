import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fonts, useTheme } from '../theme';

export function Card({ children, title }: { children: ReactNode; title?: string }) {
  const theme = useTheme();
  return <View style={[styles.card, sticker(theme)]}>
    {title && <Text accessibilityRole="header" style={[styles.heading, { color: theme.ink }]}>{title}</Text>}
    {children}
  </View>;
}
export function Body({ children, small, testID }: { children: ReactNode; small?: boolean; testID?: string }) {
  const theme = useTheme();
  return <Text testID={testID} style={{ color: theme.secondary, fontSize: small ? 12 : 14, lineHeight: small ? 20 : 22 }}>{children}</Text>;
}
// A failure the user must see; role alert so a screen reader announces it.
export function Alert({ title, message, onRetry }: { title?: string; message: string; onRetry?: () => void }) {
  const theme = useTheme();
  return <View accessibilityRole="alert" style={[styles.card, sticker(theme)]}>
    {title && <Text accessibilityRole="header" style={[styles.heading, { color: theme.exceeded }]}>{title}</Text>}
    <Text style={{ color: theme.exceeded, fontSize: 16 }}>{message}</Text>
    {onRetry && <Button label="다시 불러오기" onPress={onRetry} />}
  </View>;
}
export function Button({ label, onPress, disabled, tone = 'plain', accessibilityLabel }: {
  label: string; onPress: () => void; disabled?: boolean; tone?: 'primary' | 'plain' | 'danger'; accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const primary = tone === 'primary';
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ disabled: !!disabled }}
    disabled={disabled} onPress={onPress}
    style={[styles.button, primary && [sticker(theme, theme.lime), { borderRadius: 16, alignItems: 'center', paddingHorizontal: 20 }], { opacity: disabled ? 0.5 : 1 }]}>
    <Text style={{ color: primary ? theme.limeInk : tone === 'danger' ? theme.exceeded : theme.ink, fontSize: primary ? 18 : 16, ...(primary ? { fontFamily: fonts.display, fontWeight: '400' as const } : { fontWeight: tone === 'danger' ? '700' as const : '400' as const }) }}>{label}</Text>
  </Pressable>;
}
// Sticker look: 3px outline and a hard offset shadow (no blur). Same props on iOS and web.
function sticker(theme: ReturnType<typeof useTheme>, backgroundColor = theme.surface) {
  return { backgroundColor, borderColor: theme.line, borderWidth: 3, shadowColor: theme.shadow, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0 };
}
const styles = StyleSheet.create({
  card: { padding: 20, borderRadius: 18, gap: 12 }, heading: { fontSize: 20, fontFamily: fonts.display, fontWeight: '400' },
  button: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'flex-start' },
});
