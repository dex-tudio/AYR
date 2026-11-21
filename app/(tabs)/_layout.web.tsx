import { Redirect, Tabs } from 'expo-router';
import { useLedger } from '../../src/state/LedgerProvider';
import { useTheme } from '../../src/theme';

// Tabs exist only after onboarding; a ledger that has not finished it goes to the onboarding flow.
export default function TabsLayout() {
  const theme = useTheme();
  const { snapshot } = useLedger();
  if (snapshot?.ledger && !snapshot.ledger.onboardingCompleted) return <Redirect href="/onboarding" />;
  return <Tabs screenOptions={{
    headerShown: false, tabBarActiveTintColor: theme.ink, tabBarInactiveTintColor: theme.secondary,
    tabBarStyle: { backgroundColor: theme.surface, borderTopColor: theme.line },
    // Web preview only; iOS uses the system tab bar in _layout.tsx. Text-only tabs: an empty icon still reserves a 28pt box and squeezes the label out of the 49pt bar.
    // Hide the box and use the centered row layout; drop the icon-gap margins so the label sits in the middle.
    tabBarIcon: () => null, tabBarIconStyle: { display: 'none' }, tabBarLabelPosition: 'beside-icon',
    tabBarLabelStyle: { fontSize: 14, marginStart: 0, marginEnd: 0 },
  }}>
    <Tabs.Screen name="index" options={{ title: '오늘' }} />
    <Tabs.Screen name="monthly" options={{ title: '월별' }} />
    <Tabs.Screen name="settings" options={{ title: '설정' }} />
  </Tabs>;
}
