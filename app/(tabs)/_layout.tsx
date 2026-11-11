import { Redirect, Tabs } from 'expo-router';
import { useLedger } from '../../src/state/LedgerProvider';
import { useTheme } from '../../src/theme';

// Tabs exist only after onboarding; a ledger that has not finished it goes to the onboarding flow.
// The monthly tab is added with the monthly screen.
export default function TabsLayout() {
  const theme = useTheme();
  const { snapshot } = useLedger();
  if (snapshot?.ledger && !snapshot.ledger.onboardingCompleted) return <Redirect href="/onboarding" />;
  return <Tabs screenOptions={{
    headerShown: false, tabBarActiveTintColor: theme.ink, tabBarInactiveTintColor: theme.secondary,
    tabBarStyle: { backgroundColor: theme.surface, borderTopColor: theme.line }, tabBarLabelStyle: { fontSize: 14 }, tabBarIcon: () => null,
  }}>
    <Tabs.Screen name="index" options={{ title: '오늘' }} />
    <Tabs.Screen name="settings" options={{ title: '설정' }} />
  </Tabs>;
}
