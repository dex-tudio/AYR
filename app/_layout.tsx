import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LedgerProvider } from '../src/state/LedgerProvider';
export default function Layout() {
  return <SafeAreaProvider><LedgerProvider><Stack screenOptions={{ headerShown: false }} /></LedgerProvider></SafeAreaProvider>;
}
