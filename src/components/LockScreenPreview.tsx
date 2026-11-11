import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatMoney } from '../ledger/contracts';
import type { AppSnapshot } from '../ledger/contracts';
import { useTheme } from '../theme';
import { FitAmount } from './FitAmount';
import { Body, Card } from './ui';

// A design preview of the iPhone widget and Live Activity (iOS/Widgets/AYRWidgets.swift): amount, phrase, base, in that order.
// It is drawn from the app's current snapshot and is not a widget: nothing here is installed on, or shown by, an iPhone.
// Phrase and band come from the snapshot, so the meaning is in the words and never only in the color.
const expiredMessage = '날짜가 바뀌었어요 · 앱에서 새로고침';
const onWallpaper = '#FFFFFF';

function Caption({ children }: { children: string }) {
  const theme = useTheme();
  return <Text style={{ color: theme.secondary, fontSize: 12 }}>{children}</Text>;
}
// Each mock reads as one picture to a screen reader.
function Mock({ label, testID, style, children }: { label: string; testID: string; style: object; children: ReactNode }) {
  return <View accessible accessibilityRole="image" accessibilityLabel={label} testID={testID} style={style}>{children}</View>;
}

type Shown = { total: string; phrase: string; band: 'calm' | 'caution' | 'exceeded'; budget: string };

function LockWidget({ shown }: { shown: Shown }) {
  return <Mock testID="lock-widget" label={`잠금화면 위젯 미리보기. 오늘 쓴 돈 ${shown.total}. ${shown.phrase}`} style={[styles.wallpaper]}>
    <View style={styles.lockWidget}>
      <Text style={{ color: onWallpaper, fontSize: 12 }}>오늘</Text>
      <FitAmount text={shown.total} max={20} min={6} color={onWallpaper} testID="lock-widget-amount" />
      <Text style={{ color: onWallpaper, fontSize: 12 }}>{shown.phrase}</Text>
    </View>
  </Mock>;
}

function HomeWidget({ shown }: { shown: Shown }) {
  const theme = useTheme();
  return <Mock testID="home-widget" label={`작은 위젯 미리보기. 오늘 쓴 돈 ${shown.total}. ${shown.phrase}. 하루 기준 ${shown.budget}`}
    style={[styles.small, { backgroundColor: theme.background, borderColor: theme.line }]}>
    <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '700' }}>AYR / 오늘</Text>
    <FitAmount text={shown.total} max={26} min={6} testID="home-widget-amount" />
    <Text style={{ color: theme[shown.band], fontSize: 15, fontWeight: '700' }}>{shown.phrase}</Text>
    <Text style={{ color: theme.secondary, fontSize: 12 }}>하루 기준 {shown.budget}</Text>
  </Mock>;
}

function ActivityCard({ testID, amountID, total, message, band, base }: {
  testID: string; amountID: string; total: string; message: string; band?: Shown['band']; base?: string;
}) {
  const theme = useTheme();
  return <Mock testID={testID} label={`Live Activity 미리보기. 오늘 쓴 돈 ${total}. ${message}${base ? `. 하루 기준 ${base}` : ''}`}
    style={[styles.activity, { backgroundColor: theme.background, borderColor: theme.line }]}>
    <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '700' }}>AYR / 오늘 쓴 돈</Text>
    <FitAmount text={total} max={32} min={6} testID={amountID} />
    <Text style={{ color: band ? theme[band] : theme.ink, fontSize: 16, fontWeight: '700' }}>{message}</Text>
    {base && <Text style={{ color: theme.secondary, fontSize: 12 }}>하루 기준 {base}</Text>}
  </Mock>;
}

function Island({ shown }: { shown: Shown }) {
  const theme = useTheme();
  const icon = <View style={[styles.icon, { backgroundColor: theme.lime }]} />;
  return <View style={styles.islands}>
    <Mock testID="island-compact" label={`Dynamic Island 작은 모양 미리보기. 오늘 쓴 돈 ${shown.total}`} style={styles.compact}>
      {icon}
      <View style={{ flex: 1 }}><FitAmount text={shown.total} max={13} min={6} color={onWallpaper} testID="island-compact-amount" /></View>
    </Mock>
    <Mock testID="island-minimal" label="Dynamic Island 가장 작은 모양 미리보기. 금액 없이 아이콘만 보여요" style={styles.minimal}>{icon}</Mock>
  </View>;
}

export function LockScreenPreview({ snapshot }: { snapshot: AppSnapshot }) {
  const theme = useTheme();
  const ledger = snapshot.ledger;
  // Like the widget: a record that cannot be read or an unfinished start shows a short pointer to the app, never a zero.
  const fallback = !ledger ? '앱에서 기록 확인' : !ledger.onboardingCompleted ? 'AYR에서 시작하기' : null;
  const shown: Shown | null = ledger && !fallback
    ? { total: formatMoney(ledger.current.total), phrase: ledger.phrase, band: ledger.band, budget: formatMoney(ledger.current.budget) } : null;
  return <Card title="디자인 미리보기">
    <Body>실제 위젯이 아니에요. iPhone에서 가능한 기능이고, 여기서는 화면 디자인만 보여줘요.</Body>
    {shown ? <>
      <Caption>잠금화면 위젯 (직사각형)</Caption>
      <LockWidget shown={shown} />
      <Caption>홈 화면 작은 위젯</Caption>
      <HomeWidget shown={shown} />
      <Caption>잠금화면 Live Activity</Caption>
      <ActivityCard testID="activity" amountID="activity-amount" total={shown.total} message={shown.phrase} band={shown.band} base={shown.budget} />
      <Caption>Dynamic Island (작은 모양 · 가장 작은 모양)</Caption>
      <Island shown={shown} />
      <Caption>날짜가 바뀐 뒤 Live Activity</Caption>
      <ActivityCard testID="activity-expired" amountID="activity-expired-amount" total="0원" message={expiredMessage} />
      <Body small>한 줄 위젯과 잠금화면 위젯은 iOS가 배경과 색에 맞춰 단색으로 보여줘요. 새날이 되면 0원부터 다시 보여줘요.</Body>
    </> : <>
      <Mock testID="widget-fallback" label={`위젯 미리보기. ${fallback}`} style={[styles.small, styles.fallback, { backgroundColor: theme.background, borderColor: theme.line }]}>
        <Text style={{ color: theme.ink, fontSize: 14, fontWeight: '700' }}>{fallback}</Text>
      </Mock>
      <Body small>기록을 확인할 수 없으면 위젯은 금액 대신 앱에서 확인하라고 안내해요.</Body>
    </>}
    {snapshot.error && shown && <Body small>마지막으로 불러온 기록이에요.</Body>}
  </Card>;
}

const styles = StyleSheet.create({
  wallpaper: { backgroundColor: '#2B3326', borderRadius: 24, padding: 16, alignSelf: 'stretch' },
  lockWidget: { gap: 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', borderRadius: 16, padding: 12, maxWidth: 220 },
  small: { width: '100%', maxWidth: 170, minHeight: 158, borderWidth: 1, borderRadius: 22, padding: 16, gap: 8 },
  fallback: { justifyContent: 'center' },
  activity: { width: '100%', maxWidth: 360, borderWidth: 1, borderRadius: 22, padding: 16, gap: 8 },
  islands: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#2B3326', borderRadius: 24, padding: 16 },
  compact: { flex: 1, maxWidth: 230, height: 36, borderRadius: 18, backgroundColor: '#000000', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  minimal: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  icon: { width: 12, height: 9, borderRadius: 3 },
});
