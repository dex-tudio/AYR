import { Text, View } from 'react-native';
import { activeScenario } from '../ledger/service.web';
import { useTheme } from '../theme';

// Browser-only tool above every screen. A scenario is a URL the fake ledger starts from, so picking one or restarting reloads
// the page: the fake state lives in memory only and nothing is kept in the browser.
const scenarios = [
  ['default', '기본'], ['firstStart', '처음 시작'], ['empty', '빈 기록'], ['receptionFailure', '수신 실패'],
  ['saveFailureOnce', '저장 실패'], ['dayChange', '날짜 변경'], ['corrupt', '손상 기록'],
] as const;
const open = (scenario: string) => location.assign(scenario === 'default' ? '/' : `/?scenario=${scenario}`);

export function PreviewTools() {
  const theme = useTheme();
  const listed = scenarios.some(([value]) => value === activeScenario);
  // Solid theme tokens (not the lime bar) so the picker and its open list keep their contrast in light and dark.
  const control = { minHeight: 44, fontSize: 16, color: theme.ink, borderRadius: 12, border: `1px solid ${theme.ink}`, background: theme.surface, padding: '0 12px' };
  return <View style={{ backgroundColor: theme.lime, padding: 12, gap: 6 }}>
    <Text style={{ color: theme.limeInk, fontSize: 14, fontWeight: '700' }}>미리보기 · 가짜 기록</Text>
    <Text style={{ color: theme.limeInk, fontSize: 12 }}>실제 장부와 연결되지 않아요. 새로고침하면 처음 가짜 값으로 돌아가요. 가짜 기준일은 2026-11-11이고 날짜 변경은 2026-11-12예요.</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      <select aria-label="미리보기 시나리오" value={activeScenario} onChange={event => open(event.target.value)} style={{ ...control, flex: 1, minWidth: 100 }}>
        {scenarios.map(([value, label]) => <option key={value} value={value} style={{ color: theme.ink, background: theme.surface }}>{label}</option>)}
        {!listed && <option value={activeScenario} style={{ color: theme.ink, background: theme.surface }}>{activeScenario}</option>}
      </select>
      <button type="button" onClick={() => open(activeScenario)} style={{ ...control, fontWeight: 700, minWidth: 44 }}>다시 시작</button>
    </View>
  </View>;
}
