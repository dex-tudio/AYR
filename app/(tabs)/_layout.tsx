import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { useLedger } from '../../src/state/LedgerProvider';

// The system tab bar sizes itself to the device (safe area, Dynamic Type, dark mode), so it keeps the iOS defaults.
// Web has no system tab bar; _layout.web.tsx keeps the JS tabs for the browser preview.
// Tabs exist only after onboarding; a ledger that has not finished it goes to the onboarding flow.
export default function TabsLayout() {
  const { snapshot } = useLedger();
  if (snapshot?.ledger && !snapshot.ledger.onboardingCompleted) return <Redirect href="/onboarding" />;
  return <NativeTabs>
    <NativeTabs.Trigger name="index">
      <NativeTabs.Trigger.Label>오늘</NativeTabs.Trigger.Label>
      <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} />
    </NativeTabs.Trigger>
    <NativeTabs.Trigger name="monthly">
      <NativeTabs.Trigger.Label>월별</NativeTabs.Trigger.Label>
      <NativeTabs.Trigger.Icon sf="calendar" />
    </NativeTabs.Trigger>
    <NativeTabs.Trigger name="settings">
      <NativeTabs.Trigger.Label>설정</NativeTabs.Trigger.Label>
      <NativeTabs.Trigger.Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} />
    </NativeTabs.Trigger>
  </NativeTabs>;
}
