import { Pressable, StyleSheet, Text } from 'react-native';
import type { AppSnapshot } from '../ledger/contracts';
import { useTheme } from '../theme';

// Support comes from metadata (PaymentSource.isSupported); unsupported sources are listed but cannot be chosen.
export function SourcePicker({ metadata, selected, onChange }: { metadata: AppSnapshot['metadata']; selected: string[]; onChange: (sources: string[]) => void }) {
  const theme = useTheme();
  return <>{metadata.sources.map(source => {
    const checked = source.isSupported && selected.includes(source.raw);
    return <Pressable key={source.raw} accessibilityRole="checkbox" accessibilityLabel={source.title}
      aria-checked={checked} aria-disabled={!source.isSupported} disabled={!source.isSupported}
      onPress={() => onChange(checked ? selected.filter(raw => raw !== source.raw) : [...selected, source.raw])}
      style={[styles.row, { borderColor: theme.line, opacity: source.isSupported ? 1 : 0.6 }]}>
      <Text style={{ color: theme.ink, fontSize: 16, flex: 1 }}>{checked ? '☑ ' : '☐ '}{source.title}</Text>
      {!source.isSupported && <Text style={{ color: theme.secondary, fontSize: 14 }}>준비 중</Text>}
    </Pressable>;
  })}</>;
}
const styles = StyleSheet.create({
  row: { minHeight: 52, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
});
