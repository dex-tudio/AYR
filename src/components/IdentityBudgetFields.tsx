import { Pressable, StyleSheet, Text, TextInput, useColorScheme, View } from 'react-native';
import type { AppSnapshot } from '../ledger/contracts';
import { formatMoney, positiveMoney } from '../ledger/contracts';
import { fonts, useTheme } from '../theme';
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

const charges: Record<string, string> = { student: '혐의: 떡볶이 상습 섭취', jobSeeker: '혐의: 스터디 카페 장기 투숙', worker: '혐의: 퇴근길 보상 소비' };

// Decorative wallet silhouette against a height chart; the card's name already says who it is.
function Mugshot() {
  const theme = useTheme();
  const body = { backgroundColor: theme.wallet, borderColor: theme.critterLine, borderWidth: 2 };
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden style={styles.mugshot}>
    {[14, 34, 54].map(top => <View key={top} style={[styles.rule, { top }]} />)}
    <View style={[styles.head, body]} />
    <View style={[styles.torso, body]} />
  </View>;
}

export function IdentityBudgetFields({ metadata, identity, budget, onIdentity, onBudget }: Props) {
  const theme = useTheme();
  const dark = useColorScheme() === 'dark';
  const valid = positiveMoney(budget, metadata.maximumMoney) !== null;
  return <View style={{ gap: 12 }}>
    <View accessibilityRole="radiogroup" accessibilityLabel="신분" style={styles.group}>
      {metadata.identities.map(item => {
        const selected = item.raw === identity;
        // The card behind the text is light unless it is the selected one in dark mode, where the surface is dark.
        const ink = selected ? theme.ink : '#111111';
        const charge = Object.hasOwn(charges, item.raw) ? charges[item.raw] : undefined;
        const stampColor = dark ? theme.exceeded : '#D9342B';
        return <Pressable key={item.raw} accessibilityRole="radio" accessibilityLabel={item.title} aria-checked={selected}
          onPress={() => onIdentity(item.raw, item.defaultBudget)}
          style={[styles.choice, { borderColor: theme.line, backgroundColor: selected ? theme.surface : '#C9C9D2' },
            selected && { shadowColor: theme.lime, shadowOffset: { width: 5, height: 5 }, shadowOpacity: 1, shadowRadius: 0 }]}>
          <Mugshot />
          <View style={[styles.info, selected && styles.infoStamped]}>
            <Text maxFontSizeMultiplier={1.3} style={{ color: ink, fontSize: 24, fontFamily: fonts.display, fontWeight: '400' }}>{item.title}</Text>
            <Text style={{ color: ink, fontSize: 14 }}>하루 기준 {formatMoney(item.defaultBudget)}</Text>
            {charge && <Text style={{ color: ink, fontSize: 13 }}>{charge}</Text>}
          </View>
          {selected && <Text maxFontSizeMultiplier={1.3} style={[styles.stamp, { color: stampColor, borderColor: stampColor }]}>확인됨</Text>}
        </Pressable>;
      })}
    </View>
    <MoneyField label="하루 기준 금액(원)" value={budget} onChange={onBudget} />
    <Body>신분을 바꾸면 하루 기준도 추천 금액으로 바뀌어요. 원하는 금액으로 다시 정할 수 있어요.</Body>
    {!valid && <Text style={{ color: theme.exceeded, fontSize: 14 }}>하루 기준은 1~{formatMoney(metadata.maximumMoney)} 사이의 숫자로 적어주세요.</Text>}
  </View>;
}
const styles = StyleSheet.create({
  group: { gap: 12 },
  choice: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderWidth: 3, borderRadius: 16 },
  info: { flex: 1, gap: 2 },
  infoStamped: { paddingRight: 56 },
  mugshot: { width: 64, height: 76, backgroundColor: '#E8E2D4', borderWidth: 2, borderColor: '#111111', overflow: 'hidden', alignItems: 'center' },
  rule: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#111111', opacity: 0.35 },
  head: { width: 22, height: 22, borderRadius: 11, marginTop: 14 },
  torso: { width: 44, height: 40, borderTopLeftRadius: 22, borderTopRightRadius: 22, marginTop: 2 },
  stamp: { position: 'absolute', top: 8, right: 8, borderWidth: 3, borderRadius: 6, paddingHorizontal: 6, fontSize: 14, fontWeight: '700', transform: [{ rotate: '-14deg' }] },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 18 },
});
