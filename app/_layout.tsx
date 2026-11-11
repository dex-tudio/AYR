import { View } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LedgerGate } from '../src/components/LedgerGate';
import { PreviewTools } from '../src/preview/PreviewTools';
import { LedgerProvider } from '../src/state/LedgerProvider';
export default function Layout() {
  // The preview tools sit outside the gate so they stay available over the recovery screen. Native builds render nothing for them.
  return <SafeAreaProvider><LedgerProvider>
    <View style={{ flex: 1 }}><PreviewTools /><View style={{ flex: 1 }}><LedgerGate><Stack screenOptions={{ headerShown: false }} /></LedgerGate></View></View>
  </LedgerProvider></SafeAreaProvider>;
}
