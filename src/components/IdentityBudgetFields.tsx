import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { AppSnapshot } from '../ledger/contracts';
import { formatMoney, positiveMoney } from '../ledger/contracts';
import { useTheme } from '../theme';
import { Body } from './ui';

type Props = {
  metadata: AppSnapshot['metadata']; identity: string; budget: string;
  /** Picking an identity also hands over its default budget, from metadata. */
  onIdentity: (raw: string, defaultBudget: string) => void; onBudget: (text: string) => void;
};

export function MoneyField({ label, value, onChange, editable = true }: { label: string; value: string; onChange: (text: string) => void; editable?: boolean }) {
  const theme = useTheme();
  return <TextInput accessibilityLabel={label} placeholder={label} placeholderTextColor={theme.secondary} value={value} onChangeText={onChange}
    keyboardType="number-pad" inputMode="numeric" editable={editable} style={[styles.input, { color: theme.ink, borderColor: theme.line }]} />;
}

export function IdentityBudgetFields({ metadata, identity, budget, onIdentity, onBudget }: Props) {
  const theme = useTheme();
  const valid = positiveMoney(budget, metadata.maximumMoney) !== null;
  return <View style={{ gap: 12 }}>
    <View accessibilityRole="radiogroup" accessibilityLabel="신분" style={styles.group}>
      {metadata.identities.map(item => {
        const selected = item.raw === identity;
        return <Pressable key={item.raw} accessibilityRole="radio" accessibilityLabel={item.title} aria-checked={selected}
          onPress={() => onIdentity(item.raw, item.defaultBudget)}
          style={[styles.choice, { borderColor: selected ? theme.ink : theme.line, backgroundColor: selected ? theme.lime : 'transparent' }]}>
          <Text style={{ color: selected ? theme.limeInk : theme.ink, fontSize: 16, fontWeight: selected ? '700' : '400' }}>{item.title}</Text>
        </Pressable>;
      })}
    </View>
    <MoneyField label="하루 기준 금액(원)" value={budget} onChange={onBudget} />
    <Body>신분을 바꾸면 하루 기준도 추천 금액으로 바뀌어요. 원하는 금액으로 다시 정할 수 있어요.</Body>
    {!valid && <Text style={{ color: theme.exceeded, fontSize: 14 }}>하루 기준은 1~{formatMoney(metadata.maximumMoney)} 사이의 숫자로 적어주세요.</Text>}
  </View>;
}
const styles = StyleSheet.create({
  group: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { minHeight: 44, minWidth: 44, paddingHorizontal: 16, borderWidth: 1, borderRadius: 14, justifyContent: 'center' },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 18 },
});
