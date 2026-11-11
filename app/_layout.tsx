import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LedgerGate } from '../src/components/LedgerGate';
import { LedgerProvider } from '../src/state/LedgerProvider';
export default function Layout() {
  return <SafeAreaProvider><LedgerProvider><LedgerGate><Stack screenOptions={{ headerShown: false }} /></LedgerGate></LedgerProvider></SafeAreaProvider>;
}
